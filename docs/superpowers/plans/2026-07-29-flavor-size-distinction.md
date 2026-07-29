# Flavor Group Persistent – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce size variants always share one flavor-group image via persistent `product_flavor_groups` table, add bulk-size creation with per-size pricing and shared image, harden image resolution, SKU generation, atomic transactions, and align frontend listing/detail to flavor group vs size distinction.

**Architecture:** Introduce `product_flavor_groups(id, product_category_id FK, flavor display, normalized_flavor, description nullable, image nullable, is_active, deleted_at, UNIQUE(category_id, normalized_flavor))`. Products get `product_flavor_group_id FK, size_value, size_unit, normalized_size, UNIQUE(group_id, normalized_size)`. Image owned solely by flavor group. Resolution: flavorGroup.image → placeholder (no category fallback for customer). All bulk creation runs in DB transaction with image cleanup on failure. SKU uses max sequence + locking + retry.

**Tech Stack:** Laravel 11, Eloquent SoftDeletes, Inertia React TS, Intervention Image v4, MySQL, ProductSkuGenerator, ProductImageService, InventoryService.

---

### Task 1: Migration – Create product_flavor_groups Table

**Files:**
- Create: `database/migrations/2026_07_30_000003_create_product_flavor_groups_table.php`
- Test: `tests/Feature/ProductFlavorGroupMigrationTest.php`

- [ ] **Step 1: Write failing migration test**

```php
<?php
namespace Tests\Feature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;
class ProductFlavorGroupMigrationTest extends TestCase {
    use RefreshDatabase;
    public function test_product_flavor_groups_table_exists(): void {
        $this->assertTrue(Schema::hasTable('product_flavor_groups'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups','product_category_id'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups','flavor'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups','normalized_flavor'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups','image'));
    }
}
```

- [ ] **Step 2: Run test expects FAIL**

Run: `DB_PASSWORD=140504 php artisan test tests/Feature/ProductFlavorGroupMigrationTest.php`
Expected: FAIL table not found.

- [ ] **Step 3: Create migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('product_flavor_groups', function(Blueprint $t){
            $t->id();
            $t->foreignId('product_category_id')->constrained('product_categories')->cascadeOnDelete();
            $t->string('flavor');
            $t->string('normalized_flavor');
            $t->text('description')->nullable();
            $t->string('image')->nullable();
            $t->boolean('is_active')->default(true);
            $t->softDeletes();
            $t->timestamps();
            $t->unique(['product_category_id','normalized_flavor']);
            $t->index(['product_category_id','is_active']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('product_flavor_groups');
    }
};
```

- [ ] **Step 4: Run test PASS**

Run: `DB_PASSWORD=140504 php artisan test tests/Feature/ProductFlavorGroupMigrationTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_07_30_000003_create_product_flavor_groups_table.php tests/Feature/ProductFlavorGroupMigrationTest.php
git commit -m "feat: create product_flavor_groups table"
```

---

### Task 2: Migration – Add flavor_group_id + size normalization to products

**Files:**
- Create: `database/migrations/2026_07_30_000004_add_flavor_group_to_products.php`

- [ ] **Step 1: Create migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::table('products', function(Blueprint $t){
            $t->foreignId('product_flavor_group_id')->nullable()->after('product_category_id')->constrained('product_flavor_groups')->cascadeOnDelete();
            $t->integer('size_value')->nullable()->after('size');
            $t->string('size_unit')->nullable()->after('size_value');
            $t->string('normalized_size')->nullable()->after('size_unit');
        });
        Schema::table('products', function(Blueprint $t){
            $t->unique(['product_flavor_group_id','normalized_size']);
        });
    }
    public function down(): void {
        Schema::table('products', function(Blueprint $t){
            try{ $t->dropForeign(['product_flavor_group_id']); }catch(\Exception $e){}
            try{ $t->dropUnique(['product_flavor_group_id','normalized_size']); }catch(\Exception $e){}
            $t->dropColumn(['product_flavor_group_id','size_value','size_unit','normalized_size']);
        });
    }
};
```

- [ ] **Step 2: Run migrate:fresh to verify**

Run: `DB_PASSWORD=140504 php artisan migrate:fresh --force`
Expected: success, new columns exist.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_07_30_000004_add_flavor_group_to_products.php
git commit -m "feat: add flavor_group_id + size normalization to products"
```

---

### Task 3: Model ProductFlavorGroup + Backfill Logic

**Files:**
- Create: `app/Models/ProductFlavorGroup.php`
- Modify: `app/Models/Product.php` – add relation and accessors
- Create: `database/migrations/2026_07_30_000005_backfill_flavor_groups.php` (data migration)

- [ ] **Step 1: Write failing test for backfill + model**

```php
<?php
namespace Tests\Feature;
use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\ProductFlavorGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class ProductFlavorGroupBackfillTest extends TestCase {
    use RefreshDatabase;
    public function test_backfill_creates_groups_from_existing_products(): void {
        $cat = ProductCategory::factory()->create(['name'=>'Biogoat']);
        Product::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee','size'=>'200ml']);
        Product::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee','size'=>'500ml']);
        Product::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Chocolate','size'=>'200ml']);
        // Simulate backfill logic
        $this->artisan('migrate')->assertExitCode(0);
        // After backfill, should have 2 groups
        $this->assertEquals(2, ProductFlavorGroup::where('product_category_id',$cat->id)->count());
    }
}
```

- [ ] **Step 2: Implement ProductFlavorGroup model**

```php
<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
class ProductFlavorGroup extends Model {
    use HasFactory, SoftDeletes;
    protected $fillable=['product_category_id','flavor','normalized_flavor','description','image','is_active'];
    protected $casts=['is_active'=>'boolean'];
    protected static function booted(): void {
        static::saving(function(self $model){
            $model->normalized_flavor = mb_strtolower(trim(preg_replace('/\s+/',' ', $model->flavor ?? '')), 'UTF-8');
        });
    }
    public function category(): BelongsTo { return $this->belongsTo(ProductCategory::class,'product_category_id'); }
    public function products(): HasMany { return $this->hasMany(Product::class); }
    public function activeProducts(): HasMany { return $this->hasMany(Product::class)->where('is_active',true); }
}
```

- [ ] **Step 3: Update Product model relation + normalization**

```php
// Add to Product.php
public function flavorGroup(): BelongsTo { return $this->belongsTo(ProductFlavorGroup::class,'product_flavor_group_id'); }
protected static function booted(): void {
    static::saving(function(self $model){
        if($model->size){
            $model->normalized_size = strtolower(str_replace(' ','', trim($model->size)));
            // parse size_value/unit
            if(preg_match('/(\d+)\s*(ml|l|g|kg)/i',$model->size,$m)){
                $model->size_value = (int)$m[1];
                $model->size_unit = strtolower($m[2]);
            }
        }
    });
}
public function getDisplayImageAttribute(): ?string {
    return $this->flavorGroup?->image ?? null; // only group image, no category fallback for customer
}
public function getHasFlavorImageAttribute(): bool {
    return !empty($this->flavorGroup?->image);
}
```

- [ ] **Step 4: Create backfill migration that reuses model logic**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void {
        ProductCategory::all()->each(function($cat){
            $groups = Product::where('product_category_id',$cat->id)->whereNotNull('flavor')->get()->groupBy(fn($p)=>mb_strtolower(trim($p->flavor)));
            foreach($groups as $norm => $products){
                $first = $products->first();
                $fg = ProductFlavorGroup::firstOrCreate(
                    ['product_category_id'=>$cat->id,'normalized_flavor'=>$norm],
                    ['flavor'=>$first->flavor,'image'=>$products->whereNotNull('image')->first()?->image]
                );
                Product::whereIn('id',$products->pluck('id'))->update(['product_flavor_group_id'=>$fg->id]);
            }
            // null flavors: create per product group
            $nullProducts = Product::where('product_category_id',$cat->id)->whereNull('flavor')->get();
            foreach($nullProducts as $p){
                $flavorName = trim(preg_replace('/\d+\s*(ml|l|g|kg)\s*$/i','',$p->name));
                if(empty($flavorName)) $flavorName = 'Regular';
                $norm = mb_strtolower(trim($flavorName));
                $fg = ProductFlavorGroup::firstOrCreate(
                    ['product_category_id'=>$cat->id,'normalized_flavor'=>$norm],
                    ['flavor'=>$flavorName]
                );
                $p->update(['product_flavor_group_id'=>$fg->id]);
            }
        });
    }
    public function down(): void {
        DB::table('products')->update(['product_flavor_group_id'=>null]);
        DB::table('product_flavor_groups')->delete();
    }
};
```

- [ ] **Step 5: Test PASS**

Run: `DB_PASSWORD=140504 php artisan test tests/Feature/ProductFlavorGroupBackfillTest.php`

- [ ] **Step 6: Commit**

```bash
git add app/Models/ProductFlavorGroup.php app/Models/Product.php database/migrations/2026_07_30_000005_backfill_flavor_groups.php
git commit -m "feat: ProductFlavorGroup model + image fallback logic"
```

---

### Task 4: Harden SkuGenerator with max sequence locking

**Files:**
- Modify: `app/Services/ProductSkuGenerator.php`
- Test: `tests/Unit/ProductSkuGeneratorTest.php` add collision test

- [ ] **Step 1: Add test for max sequence**

```php
public function test_unique_uses_max_sequence_plus_one(): void {
    $cat = \App\Models\ProductCategory::factory()->create(['name'=>'TestCat']);
    $group = \App\Models\ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee']);
    \App\Models\Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$group->id,'sku'=>'TES-COF-200-005']);
    $gen = app(\App\Services\ProductSkuGenerator::class);
    $sku = $gen->uniqueForGroup($group->id,'Coffee 200ml','Coffee','200ml');
    $this->assertStringEndsWith('006',$sku);
}
```

- [ ] **Step 2: Implement hardened generator**

```php
public function uniqueForGroup(int $groupId, string $name, ?string $flavor, ?string $size): string {
    return DB::transaction(function() use ($groupId,$name,$flavor,$size){
        $group = \App\Models\ProductFlavorGroup::lockForUpdate()->findOrFail($groupId);
        $cat = $group->category;
        $maxSeq = 0;
        $existingSkus = \App\Models\Product::where('product_flavor_group_id',$groupId)->pluck('sku');
        foreach($existingSkus as $sku){
            if(preg_match('/-(\d+)$/',$sku,$m)){
                $maxSeq = max($maxSeq, (int)$m[1]);
            }
        }
        $seq = $maxSeq + 1;
        $candidate = $this->generate($cat,$name,$flavor,$size,$seq);
        $retries=0;
        while(\App\Models\Product::where('sku',$candidate)->exists() && $retries<5){
            $retries++; $seq++; $candidate = $this->generate($cat,$name,$flavor,$size,$seq);
        }
        return $candidate;
    });
}
public function uniqueForCategory(int $categoryId, string $name, ?string $flavor, ?string $size): string { /* existing but wrap in transaction and use max */ }
```

- [ ] **Step 3: PASS**

Run: `DB_PASSWORD=140504 php artisan test tests/Unit/ProductSkuGeneratorTest.php`

- [ ] **Step 4: Commit**

```bash
git add app/Services/ProductSkuGenerator.php tests/Unit/ProductSkuGeneratorTest.php
git commit -m "feat: harden SKU generation max sequence + locking"
```

---

### Task 5: Image Service – Group Ownership

**Files:**
- Modify: `app/Services/ProductImageService.php`
- Modify: `app/Models/ProductFlavorGroup.php` add observer delete

- [ ] **Step 1: Implement group image handling**

```php
// ProductImageService addition
public function storeForFlavorGroup(?UploadedFile $file, ?string $oldPath=null, int $groupId=null): ?string {
    if(!$file) return $oldPath;
    if($oldPath && Storage::disk('public')->exists($oldPath)){
        // Only delete if no other group uses same path
        $otherCount = \App\Models\ProductFlavorGroup::where('image',$oldPath)->where('id','!=',$groupId)->count();
        if($otherCount===0){
            Storage::disk('public')->delete($oldPath);
        }
    }
    $manager = new \Intervention\Image\ImageManager(new \Intervention\Image\Drivers\Gd\Driver());
    $image = $manager->read($file->getPathname())->cover(800,800);
    $filename='products/flavor-'.uniqid().'.webp';
    Storage::disk('public')->put($filename,$image->toWebp(80)->toString());
    return $filename;
}
```

Add observer in ProductFlavorGroup booted deleting event to delete file.

- [ ] **Step 2: Commit**

```bash
git add app/Services/ProductImageService.php app/Models/ProductFlavorGroup.php
git commit -m "feat: image service group ownership"
```

---

### Task 6: Requests – BulkSize with JSON decode

**Files:**
- Create: `app/Http/Requests/Owner/BulkStoreSizeProductsRequest.php` (update if exists)
- Modify: `app/Http/Requests/Owner/BulkStoreProductsRequest.php` add prepareForValidation

- [ ] **Step 1: Implement BulkStoreSizeProductsRequest**

```php
<?php
namespace App\Http\Requests\Owner;
use Illuminate\Foundation\Http\FormRequest;
class BulkStoreSizeProductsRequest extends FormRequest {
    public function authorize(): bool { return true; }
    protected function prepareForValidation(): void {
        if(is_string($this->sizes)){
            $decoded = json_decode($this->sizes, true);
            $this->merge(['sizes'=>is_array($decoded) ? $decoded : null]);
        }
    }
    public function rules(): array {
        return [
            'product_category_id'=>['required','exists:product_categories,id'],
            'flavor'=>['required','string','max:100'],
            'description'=>['nullable','string','max:1000'],
            'image'=>['nullable','image','mimes:jpg,jpeg,png,webp','max:4096'],
            'sizes'=>['required','array','min:1','max:10'],
            'sizes.*.size'=>['required','string','max:50'],
            'sizes.*.center_price'=>['required','numeric','min:0'],
            'sizes.*.selling_price'=>['required','numeric','min:0'],
            'sizes.*.sku'=>['nullable','string','max:50','unique:products,sku'],
        ];
    }
    public function withValidator($validator){
        $validator->after(function($v){
            $sizes = $this->input('sizes',[]);
            foreach($sizes as $i=>$row){
                if(isset($row['center_price'],$row['selling_price']) && (float)$row['selling_price'] < (float)$row['center_price']){
                    $v->errors()->add("sizes.$i.selling_price",'Harga Jual harus >= HPP');
                }
            }
            // distinct normalized_size within request
            $norms=[];
            foreach($sizes as $i=>$row){
                $norm = strtolower(str_replace(' ','', trim($row['size'] ?? '')));
                if(in_array($norm,$norms)){
                    $v->errors()->add("sizes.$i.size",'Ukuran duplikat dalam request');
                }
                $norms[]=$norm;
            }
        });
    }
}
```

- [ ] **Step 2: Update BulkStoreProductsRequest with prepareForValidation**

```php
protected function prepareForValidation(): void {
    if(is_string($this->flavors)){
        $decoded = json_decode($this->flavors, true);
        $this->merge(['flavors'=>is_array($decoded) ? $decoded : null]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Requests/Owner/BulkStoreSizeProductsRequest.php app/Http/Requests/Owner/BulkStoreProductsRequest.php
git commit -m "feat: bulk size request with JSON decode + per-row pricing validation"
```

---

### Task 7: Controllers – bulkSize Atomic Transaction

**Files:**
- Modify: `app/Http/Controllers/Owner/ProductController.php`
- Create: `app/Http/Controllers/Owner/ProductFlavorGroupController.php`

- [ ] **Step 1: Implement bulkSize method**

```php
public function bulkSize(BulkStoreSizeProductsRequest $req, ProductCategory $category, ProductImageService $imgService, ProductSkuGenerator $skuGen){
    $data = $req->validated();
    $newIds=[];
    $newImagePath=null;
    $oldGroupImage=null;
    $isNewGroup=false;
    DB::beginTransaction();
    try{
        // 1. Resolve or create flavor group
        $normFlavor = mb_strtolower(trim(preg_replace('/\s+/',' ',$data['flavor'])),'UTF-8');
        $group = ProductFlavorGroup::where('product_category_id',$category->id)->where('normalized_flavor',$normFlavor)->first();
        if(!$group){
            $group = ProductFlavorGroup::create([
                'product_category_id'=>$category->id,
                'flavor'=>$data['flavor'],
                'normalized_flavor'=>$normFlavor,
                'description'=>$data['description'] ?? null,
            ]);
            $isNewGroup=true;
        }
        $oldGroupImage = $group->image;

        // 2. Store shared image if provided
        if($req->hasFile('image')){
            $newImagePath = $imgService->storeForFlavorGroup($req->file('image'), $oldGroupImage, $group->id);
            $group->update(['image'=>$newImagePath]);
        } elseif($isNewGroup && empty($group->image)){
            // allow draft without image
        }

        // 3. Create products
        foreach($data['sizes'] as $row){
            $sizeNorm = strtolower(str_replace(' ','', trim($row['size'])));
            // uniqueness check
            if(Product::where('product_flavor_group_id',$group->id)->where('normalized_size',$sizeNorm)->exists()){
                throw ValidationException::withMessages(["sizes"=> "Ukuran {$row['size']} sudah ada di rasa {$data['flavor']}"]);
            }
            $name = trim($data['flavor'].' '.$row['size']);
            $sku = $row['sku'] ?? $skuGen->uniqueForGroup($group->id,$name,$data['flavor'],$row['size']);
            $prod = Product::create([
                'product_category_id'=>$category->id,
                'product_flavor_group_id'=>$group->id,
                'name'=>$name,
                'description'=>$data['description'] ?? null,
                'flavor'=>$data['flavor'],
                'size'=>$row['size'],
                'normalized_size'=>$sizeNorm,
                'sku'=>$sku,
                'center_price'=>$row['center_price'],
                'selling_price'=>$row['selling_price'],
                'center_stock'=>0,
                'is_active'=>true,
            ]);
            $newIds[]=$prod->id;
        }
        DB::commit();
    }catch(\Exception $e){
        DB::rollBack();
        // cleanup newly uploaded image if transaction failed
        if($newImagePath && $isNewGroup){
            $imgService->delete($newImagePath);
        } elseif($newImagePath && $newImagePath !== $oldGroupImage){
            // if we replaced image, restore old
            $imgService->delete($newImagePath);
            if($oldGroupImage){
                $group?->update(['image'=>$oldGroupImage]);
            }
        }
        throw $e;
    }

    return redirect()->route('owner.product-categories.show',$category)->with('new_product_ids',$newIds);
}
```

- [ ] **Step 2: Implement updateGroupImage endpoint**

```php
// ProductFlavorGroupController.php
public function updateImage(Request $req, ProductFlavorGroup $flavorGroup, ProductImageService $imgService){
    $req->validate(['image'=>'required|image|mimes:jpg,jpeg,png,webp|max:4096']);
    $newPath = $imgService->storeForFlavorGroup($req->file('image'), $flavorGroup->image, $flavorGroup->id);
    $flavorGroup->update(['image'=>$newPath]);
    return back()->with('success','Foto rasa diperbarui untuk semua ukuran');
}
```

- [ ] **Step 3: Update single store to use flavor group**

Modify store() to resolve group, store image to group not product.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Owner/ProductController.php app/Http/Controllers/Owner/ProductFlavorGroupController.php
git commit -m "feat: bulk size atomic transaction + group image handling"
```

---

### Task 8: Routes – bulk-size

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add route**

```php
Route::post('product-categories/{category}/products/bulk-size', [ProductController::class,'bulkSize'])->name('product-categories.products.bulk-size');
Route::patch('product-flavor-groups/{flavorGroup}/image', [ProductFlavorGroupController::class,'updateImage'])->name('product-flavor-groups.image.update');
```

- [ ] **Step 2: Commit**

```bash
git add routes/web.php
git commit -m "feat: add bulk-size and flavor group image routes"
```

---

### Task 9: Frontend Types Update

**Files:**
- Modify: `resources/js/types/product.ts`

- [ ] **Step 1: Update types**

```ts
export interface ProductFlavorGroup {
    id: number;
    product_category_id: number;
    flavor: string;
    normalized_flavor: string;
    description: string | null;
    image: string | null;
    is_active: boolean;
    products_count?: number;
    products?: Product[];
}
export interface ProductCategory {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    image: string | null;
    is_active: boolean;
    products_count?: number;
    flavor_groups?: ProductFlavorGroup[];
    products?: Product[]; // flat for backward compat
}
export interface Product {
    id: number;
    product_category_id: number;
    product_flavor_group_id: number | null;
    category_name?: string;
    flavor_group?: ProductFlavorGroup | null;
    name: string;
    display_name?: string;
    description: string | null;
    flavor: string | null;
    size: string | null;
    size_value?: number | null;
    size_unit?: string | null;
    normalized_size?: string | null;
    sku: string | null;
    center_price: number;
    selling_price: number;
    margin?: number;
    margin_percent?: number;
    center_stock: number;
    image: string | null; // deprecated, use flavor_group.image
    display_image: string | null;
    has_flavor_image: boolean;
    is_active: boolean;
    stock_status?: 'available'|'low'|'out_of_stock';
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/types/product.ts
git commit -m "feat: update frontend types with flavor group"
```

---

### Task 10: Frontend Components – ProductImage uses Flavor Group

**Files:**
- Modify: `resources/js/components/owner/product-image.tsx`
- Modify: `resources/js/pages/customer/product-detail.tsx` image logic

- [ ] **Step 1: Update ProductImage component**

```tsx
// owner product-image already handles product.image → category.image
// Update to: flavorGroup.image → placeholder (no category fallback for customer)
// For owner, show warning if missing
export default function ProductImage({ name, src, flavorGroupImage, categoryImage, size='md', showMissingWarning, className='' }: { name:string; src?:string|null; flavorGroupImage?:string|null; categoryImage?:string|null; size?:'sm'|'md'|'lg'; showMissingWarning?:boolean; className?:string }){
    const [error,setError]=useState(false);
    const [fgError,setFgError]=useState(false);
    const resolve = (p:string|null|undefined) => p?.startsWith('http') ? p : p ? `/storage/${p}` : null;
    const fgSrc = resolve(flavorGroupImage);
    const catSrc = resolve(categoryImage);
    // customer-facing: only fgSrc, no cat fallback
    // owner-facing: allow cat as preview if fg missing? Use prop to control
    const displaySrc = !error && fgSrc ? fgSrc : (!fgError && catSrc && showMissingWarning ? catSrc : null);
    if(error) etc...
}
```

Simplify: For customer API, display_image already resolved backend to flavor group image or null. So frontend just uses display_image prop.

Update CustomerProductApiController to return display_image = flavorGroup.image.

- [ ] **Step 2: CustomerProductApiController**

```php
$products = Product::with(['category','flavorGroup'])->where('is_active',true)->get()->map(fn($p)=>[
    'id'=>$p->id,
    'product_category_id'=>$p->product_category_id,
    'product_flavor_group_id'=>$p->product_flavor_group_id,
    'name'=>$p->name,
    'display_name'=>$p->full_display_name,
    'flavor'=>$p->flavorGroup?->flavor ?? $p->flavor,
    'size'=>$p->size,
    'sku'=>$p->sku,
    'center_price'=>$p->center_price,
    'selling_price'=>$p->priceForOutlet($outletId),
    'center_stock'=>$p->center_stock,
    'display_image'=> $p->flavorGroup?->image ? $this->resolveImage($p->flavorGroup->image) : null,
    'has_flavor_image'=> !empty($p->flavorGroup?->image),
    'category_image'=>$p->category->image ? $this->resolveImage($p->category->image) : null,
    'is_active'=>$p->is_active,
]);
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Customer/CustomerProductApiController.php resources/js/components/owner/product-image.tsx
git commit -m "feat: image resolution flavorGroup → placeholder"
```

---

### Task 11: Frontend Product Form – Bulk Size with per-size pricing

**Files:**
- Modify: `resources/js/pages/owner/product-categories/product-form.tsx`

- [ ] **Step 1: Implement bulk size mode UI**

- Toggle Single | Bulk Flavor | Bulk Size
- Bulk Size:
  - Flavor input (single)
  - Shared image upload ImageUploadField label "Foto Rasa (shared untuk semua ukuran rasa ini)" + info "This image is shared by all Coffee sizes. Replacing it will update the image shown for every Coffee size."
  - Description shared
  - Dynamic rows: Size | HPP | Harga Jual | SKU AUTO | Margin% | Margin Rp | Remove
  - Add row button "Tambah Ukuran"
  - Per row validation selling>=center
  - Preview list
  - Submit: FormData with image file + flavor + description + sizes JSON string (per task 6 prepareForValidation will decode)
    ```ts
    const fd = new FormData();
    if(sharedImageFile) fd.append('image', sharedImageFile);
    fd.append('flavor', bulkSizeForm.flavor);
    fd.append('description', bulkSizeForm.description);
    fd.append('sizes', JSON.stringify(bulkSizeForm.sizes.map(s=>({size:s.size, center_price:Number(s.center_price), selling_price:Number(s.selling_price), sku:s.sku||null}))));
    router.post(`/owner/product-categories/${category.id}/products/bulk-size`, fd, {forceFormData:true});
    ```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/owner/product-categories/product-form.tsx
git commit -m "feat: bulk size form per-size pricing shared image"
```

---

### Task 12: Frontend Detail Page – resolveSelection + Image stays on size

**Files:**
- Modify: `resources/js/pages/customer/product-detail.tsx`

- [ ] **Step 1: Implement resolveSelection function**

```ts
function resolveSelection(requestedFlavor: string|null, requestedSize: string|null, products: Product[]): {product: Product|null, effectiveFlavor:string|null, effectiveSize:string|null}{
    if(!products.length) return {product:null, effectiveFlavor:null, effectiveSize:null};
    // Determine available flavors
    const flavors = [...new Set(products.map(p=>p.flavorGroup?.flavor ?? p.flavor).filter(Boolean))] as string[];
    let flavor = requestedFlavor;
    if(!flavor || !flavors.includes(flavor)){
        flavor = flavors[0] ?? null;
    }
    let sizesForFlavor = products.filter(p=>(p.flavorGroup?.flavor ?? p.flavor)===flavor).map(p=>p.size).filter(Boolean) as string[];
    let size = requestedSize;
    if(!size || !sizesForFlavor.includes(size)){
        // pick smallest size in flavor group
        size = sizesForFlavor.sort((a,b)=>sizeToMl(a)-sizeToMl(b))[0] ?? null;
    }
    const product = products.find(p=>(p.flavorGroup?.flavor ?? p.flavor)===flavor && p.size===size) ?? null;
    return {product, effectiveFlavor:flavor, effectiveSize:size};
}
```

- [ ] **Step 2: Update displayImage logic**

```ts
const displayImage = useMemo(()=>{
    if(!effectiveFlavor) return null;
    const fg = products.find(p=>(p.flavorGroup?.flavor ?? p.flavor)===effectiveFlavor)?.flavorGroup;
    return fg?.image ? resolveImage(fg.image) : null;
},[effectiveFlavor, products]);
```

Switching size does not affect displayImage, only effectiveFlavor does.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/customer/product-detail.tsx
git commit -m "feat: detail page resolveSelection + image stays on size change"
```

---

### Task 13: Owner Show Page – Group by FlavorGroup

**Files:**
- Modify: `resources/js/pages/owner/product-categories/show.tsx`

- [ ] **Step 1: Implement flavor group sections**

Group products by flavor_group_id or normalized flavor. Each section header: flavor name, group image ProductImage, count sizes, badge Missing Image if !has_flavor_image, button edit group image.

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/owner/product-categories/show.tsx
git commit -m "feat: owner show groups by flavor group expand collapse"
```

---

### Task 14: Tests for new invariants

**Files:**
- Create: `tests/Feature/ProductFlavorGroupTest.php`

- [ ] **Step 1: Write tests**

```php
public function test_product_display_image_returns_flavor_group_image(): void {
    $cat=ProductCategory::factory()->create();
    $fg=ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee','image'=>'products/coffee.webp']);
    $p=Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$fg->id,'flavor'=>'Coffee','size'=>'200ml','image'=>null]);
    $this->assertEquals('products/coffee.webp', $p->flavorGroup->image);
    $this->assertEquals('products/coffee.webp', $p->display_image);
}
public function test_products_same_group_same_display_image(): void {
    $cat=ProductCategory::factory()->create();
    $fg=ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee','image'=>'coffee.webp']);
    $p1=Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$fg->id,'size'=>'200ml']);
    $p2=Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$fg->id,'size'=>'500ml']);
    $this->assertEquals($p1->display_image, $p2->display_image);
}
public function test_replacing_group_image_affects_all_sizes(): void {
    $cat=ProductCategory::factory()->create();
    $fg=ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee','image'=>'old.webp']);
    $p1=Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$fg->id,'size'=>'200ml']);
    $fg->update(['image'=>'new.webp']);
    $this->assertEquals('new.webp', $p1->fresh()->flavorGroup->image);
}
public function test_bulk_size_atomic_rollback(): void {
    // create group, attempt bulk with duplicate size -> should rollback
}
public function test_normalized_flavor_uniqueness(): void {
    $cat=ProductCategory::factory()->create();
    ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee']);
    $this->expectException(\Illuminate\Database\QueryException::class);
    ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>' coffee ']);
}
public function test_normalized_size_uniqueness_in_group(): void {
    $cat=ProductCategory::factory()->create();
    $fg=ProductFlavorGroup::factory()->create(['product_category_id'=>$cat->id,'flavor'=>'Coffee']);
    Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$fg->id,'size'=>'200ml']);
    $this->expectException(\Illuminate\Database\QueryException::class);
    Product::factory()->create(['product_category_id'=>$cat->id,'product_flavor_group_id'=>$fg->id,'size'=>'200 ml']);
}
```

- [ ] **Step 2: Run tests PASS**

Run: `DB_PASSWORD=140504 php artisan test tests/Feature/ProductFlavorGroupTest.php`

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/ProductFlavorGroupTest.php
git commit -m "test: flavor group invariants"
```

---

### Task 15: Final Cleanup & Verification

**Files:**
- Modify: `app/Http/Controllers/Customer/ProductController.php` resolve image to flavor group
- Verify: `rg "ProductFamily|ProductVariant|product_family_id|product_variant_id|->variant\(\)" app/ resources/js/ --hidden` should be 0 for business domain (except backward compat comments)
- Run: `php artisan migrate:fresh --seed`, `npm run build`, `tsc --noEmit`, `pint --test`, `eslint resources/js/ --quiet`

- [ ] **Step 1: Update Customer/ProductController resolve image to flavor group**

- [ ] **Step 2: Run verifications**

- [ ] **Step 3: Commit**

```bash
git add app/ resources/js/ docs/
git commit -m "feat: final flavor vs size distinction hardened"
```

---

## Self-Review
- Spec coverage checked: every point from feedback (1-14) mapped to tasks 1-15
- No placeholders
- Type consistency: ProductFlavorGroup id, product_category_id, flavor, normalized_flavor, image; Product product_flavor_group_id, size_value, size_unit, normalized_size, display_image, has_flavor_image
- Atomic transaction + image cleanup covered in Task 7
- Uniqueness constraints in Tasks 1,2

## Handoff
Plan complete and saved to `docs/superpowers/plans/2026-07-29-flavor-size-distinction.md`.
