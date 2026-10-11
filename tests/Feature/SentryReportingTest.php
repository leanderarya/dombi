<?php

namespace Tests\Feature;

use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Support\Facades\Log;
use Sentry\ClientBuilder;
use Sentry\Event;
use Sentry\SentrySdk;
use Sentry\Severity;
use Sentry\State\Hub;
use Sentry\State\HubInterface;
use Sentry\Transport\Result;
use Sentry\Transport\ResultStatus;
use Sentry\Transport\TransportInterface;
use Tests\TestCase;

/**
 * What matters is not that an event is built, but how many leave. The log
 * channel and the exception hook both reach Sentry, and the interesting
 * failure mode is the one where they both report the same Throwable.
 */
class SentryReportingTest extends TestCase
{
    /** @var \ArrayObject<int, Event> */
    private \ArrayObject $sent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sent = new \ArrayObject;

        $transport = new class($this->sent) implements TransportInterface
        {
            public function __construct(private \ArrayObject $sent) {}

            public function send(Event $event): Result
            {
                $this->sent[] = $event;

                return new Result(ResultStatus::success(), $event);
            }

            public function close(?int $timeout = null): Result
            {
                return new Result(ResultStatus::success());
            }
        };

        // The DSN is not in the test env, so reuse whatever options the app
        // already resolved rather than inventing a second configuration.
        $options = app('sentry')->getClient()->getOptions();

        $hub = new Hub((new ClientBuilder($options))->setTransport($transport)->getClient());

        $this->app->instance(HubInterface::class, $hub);
        SentrySdk::setCurrentHub($hub);

        // The channel reads the hub when it is built, and it is built lazily,
        // so it has to be dropped for the swap above to reach it.
        Log::forgetChannel('sentry');
        config(['logging.default' => 'sentry']);
    }

    public function test_a_logged_error_produces_exactly_one_event(): void
    {
        Log::error('Failed to create notification: disk on fire');

        $this->assertCount(1, $this->sent);
    }

    public function test_a_reported_exception_produces_exactly_one_event(): void
    {
        $this->app->make(ExceptionHandler::class)->report(new \RuntimeException('boom'));

        // Two events would mean the log channel claimed the exception as well.
        // One, carrying the exception, means the hook owns it — the path that
        // gets the transaction name and the mechanism hint.
        $this->assertCount(1, $this->sent);
        $this->assertNotEmpty($this->sent[0]->getExceptions());
    }

    public function test_a_logged_error_is_reported_at_error_severity(): void
    {
        Log::error('Failed to dispatch push: gateway refused');

        $this->assertEquals(Severity::error(), $this->sent[0]->getLevel());
        $this->assertSame('Failed to dispatch push: gateway refused', $this->sent[0]->getMessage());
    }

    public function test_informational_logs_stay_out_of_sentry(): void
    {
        // The channel's level defaults to DEBUG when it is left unset, which
        // would turn every Log::info() in the app into a Sentry event.
        Log::info('order confirmed');
        Log::warning('slow query');

        $this->assertCount(0, $this->sent);
    }
}
