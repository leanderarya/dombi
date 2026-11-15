"""Synthetic provisioning tests. Temporary directories only; no host is touched."""

import hashlib
import importlib.util
import io
from contextlib import redirect_stderr, redirect_stdout
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest import mock


SOURCE = Path(__file__).with_name("provision_checkpoint_tool.py").resolve()
SPEC = importlib.util.spec_from_file_location("provision_checkpoint_tool", SOURCE)
provision = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = provision
SPEC.loader.exec_module(provision)

LOCK = provision.LOCK_NAME
TOOL = provision.TOOL_NAME


class ProvisioningTests(unittest.TestCase):
    def setUp(self):
        temporary = Path(tempfile.gettempdir()).resolve()
        preferred = temporary / "opencode"
        self.temporary = tempfile.TemporaryDirectory(
            prefix="dombi-provisioning-synthetic-",
            dir=preferred if preferred.is_dir() else temporary,
        )
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        os.chmod(self.base, 0o700)
        self.private = self.base / "private"
        self.private.mkdir(mode=0o700)
        self.app_root = self.base / "app"
        self.app_root.mkdir(mode=0o700)
        self.tool = self.base / "reviewed_tool.py"
        self.tool.write_bytes(b"#!/usr/bin/env python3\nprint('synthetic tool')\n")
        os.chmod(self.tool, 0o644)
        self.tool_sha256 = hashlib.sha256(self.tool.read_bytes()).hexdigest()

    def run_main(self, *arguments):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = provision.main(list(arguments))
        return code, out.getvalue(), err.getvalue()

    def arguments(self, *extra):
        return ["--tool", str(self.tool), "--private", str(self.private),
                "--app-root", str(self.app_root), *extra]

    def entries(self, directory=None):
        return sorted(os.listdir(directory or self.private))

    def assert_private_regular_single_link(self, path):
        s = path.lstat()
        self.assertTrue(stat.S_ISREG(s.st_mode))
        self.assertFalse(stat.S_ISLNK(s.st_mode))
        self.assertEqual(s.st_nlink, 1)
        self.assertEqual(stat.S_IMODE(s.st_mode), 0o600)
        self.assertEqual(s.st_uid, os.geteuid())

    # --- dry run ---------------------------------------------------------

    def test_dry_run_is_the_default_and_writes_nothing(self):
        code, out, err = self.run_main(*self.arguments())
        self.assertEqual(code, 0)
        self.assertEqual(err, "")
        self.assertIn("PLAN writes=0", out)
        self.assertIn("PLAN tool=%s sha256=%s" % (self.tool, self.tool_sha256), out)
        self.assertIn("action=create-lock", out)
        self.assertIn("action=publish-tool", out)
        self.assertIn("RESULT PLAN_ONLY_NO_WRITES", out)
        self.assertEqual(self.entries(), [])

    def test_dry_run_with_explicit_actions_still_writes_nothing(self):
        code, out, _ = self.run_main(*self.arguments("--create-lock", "--publish-tool"))
        self.assertEqual(code, 0)
        self.assertIn("RESULT PLAN_ONLY_NO_WRITES", out)
        self.assertEqual(self.entries(), [])

    def test_apply_requires_an_explicit_action(self):
        code, out, err = self.run_main(*self.arguments("--apply"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("explicit_action_required", err)
        self.assertEqual(self.entries(), [])

    # --- lock ------------------------------------------------------------

    def test_lock_creation_is_private_regular_single_link(self):
        code, out, err = self.run_main(*self.arguments("--apply", "--create-lock"))
        self.assertEqual(code, 0, err)
        self.assertIn("RESULT PROVISIONED create_lock=done publish_tool=skipped", out)
        self.assert_private_regular_single_link(self.private / LOCK)
        self.assertEqual(self.entries(), [LOCK])

    def test_lock_creation_refuses_to_overwrite_and_is_idempotent_safe(self):
        first, _, err = self.run_main(*self.arguments("--apply", "--create-lock"))
        self.assertEqual(first, 0, err)
        before = (self.private / LOCK).lstat()
        digest_before = hashlib.sha256((self.private / LOCK).read_bytes()).hexdigest()
        second, out, err = self.run_main(*self.arguments("--apply", "--create-lock"))
        self.assertEqual((second, out), (1, ""))
        self.assertIn("lock_exists", err)
        after = (self.private / LOCK).lstat()
        self.assertEqual((before.st_ino, before.st_mtime_ns),
                         (after.st_ino, after.st_mtime_ns))
        self.assertEqual(digest_before,
                         hashlib.sha256((self.private / LOCK).read_bytes()).hexdigest())

    def test_existing_regular_file_at_lock_path_is_refused(self):
        target = self.private / LOCK
        target.write_bytes(b"operator-owned, not ours\n")
        os.chmod(target, 0o600)
        code, out, err = self.run_main(*self.arguments("--apply", "--create-lock"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("lock_exists", err)
        self.assertEqual(target.read_bytes(), b"operator-owned, not ours\n")
        self.assertEqual(self.entries(), [LOCK])

    def test_broken_symlink_at_lock_path_is_refused(self):
        (self.private / LOCK).symlink_to(self.base / "absent-target")
        code, out, err = self.run_main(*self.arguments("--apply", "--create-lock"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("lock_exists", err)
        self.assertTrue((self.private / LOCK).is_symlink())
        self.assertEqual(self.entries(), [LOCK])

    def test_lock_plan_refuses_an_existing_entry(self):
        (self.private / LOCK).write_bytes(b"")
        os.chmod(self.private / LOCK, 0o600)
        code, out, err = self.run_main(*self.arguments("--create-lock"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("lock_exists", err)

    # --- private parent --------------------------------------------------

    def test_symlinked_private_directory_is_refused(self):
        real = self.base / "real-private"
        real.mkdir(mode=0o700)
        link = self.base / "linked-private"
        link.symlink_to(real)
        code, out, err = self.run_main(
            "--tool", str(self.tool), "--private", str(link), "--app-root",
            str(self.app_root), "--apply", "--create-lock", "--publish-tool")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("symlink_ancestor", err)
        self.assertEqual(os.listdir(real), [])

    def test_symlinked_ancestor_above_private_is_refused(self):
        real = self.base / "real"
        (real / "private").mkdir(parents=True, mode=0o700)
        link = self.base / "linked"
        link.symlink_to(real)
        code, out, err = self.run_main(
            "--tool", str(self.tool), "--private", str(link / "private"),
            "--app-root", str(self.app_root), "--apply", "--create-lock")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("symlink_ancestor", err)
        self.assertEqual(os.listdir(real / "private"), [])

    def test_world_writable_private_directory_is_refused(self):
        os.chmod(self.private, 0o777)
        code, out, err = self.run_main(*self.arguments("--apply", "--create-lock",
                                                       "--publish-tool"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("private_mode", err)
        self.assertEqual(self.entries(), [])

    def test_writable_by_group_private_directory_is_refused(self):
        os.chmod(self.private, 0o770)
        code, out, err = self.run_main(*self.arguments())
        self.assertEqual((code, out), (1, ""))
        self.assertIn("private_mode", err)

    def test_missing_private_directory_is_refused(self):
        missing = self.base / "absent"
        code, out, err = self.run_main("--tool", str(self.tool), "--private",
                                       str(missing), "--app-root", str(self.app_root),
                                       "--apply", "--create-lock")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("io_error", err)
        self.assertFalse(missing.exists())

    # --- tool publication ------------------------------------------------

    def test_tool_publish_verifies_digest_and_mode(self):
        code, out, err = self.run_main(*self.arguments("--apply", "--publish-tool"))
        self.assertEqual(code, 0, err)
        published = self.private / TOOL
        self.assertIn("sha256=%s" % self.tool_sha256, out)
        self.assert_private_regular_single_link(published)
        self.assertEqual(published.read_bytes(), self.tool.read_bytes())
        self.assertEqual(hashlib.sha256(published.read_bytes()).hexdigest(),
                         self.tool_sha256)
        self.assertEqual(self.entries(), [TOOL])

    def test_tool_publish_refuses_an_existing_destination(self):
        destination = self.private / TOOL
        destination.write_bytes(b"existing reviewed copy\n")
        os.chmod(destination, 0o600)
        code, out, err = self.run_main(*self.arguments("--apply", "--publish-tool"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("tool_destination_exists", err)
        self.assertEqual(destination.read_bytes(), b"existing reviewed copy\n")
        self.assertEqual(self.entries(), [TOOL])

    def test_tool_publish_refuses_a_broken_symlink_destination(self):
        (self.private / TOOL).symlink_to(self.base / "absent-target")
        code, out, err = self.run_main(*self.arguments("--apply", "--publish-tool"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("tool_destination_exists", err)
        self.assertEqual(self.entries(), [TOOL])

    def test_mismatched_pinned_digest_is_refused_without_writing(self):
        code, out, err = self.run_main(
            *self.arguments("--apply", "--create-lock", "--publish-tool",
                            "--expected-tool-sha256", "0" * 64))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("tool_digest_mismatch", err)
        self.assertEqual(self.entries(), [])

    def test_mismatched_pinned_digest_is_refused_in_plan_mode(self):
        code, out, err = self.run_main(
            *self.arguments("--expected-tool-sha256", "a" * 64))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("tool_digest_mismatch", err)
        self.assertEqual(self.entries(), [])

    def test_matching_pinned_digest_is_accepted(self):
        code, _, err = self.run_main(
            *self.arguments("--apply", "--publish-tool", "--expected-tool-sha256",
                            self.tool_sha256))
        self.assertEqual(code, 0, err)
        self.assertEqual(self.entries(), [TOOL])

    def test_malformed_pinned_digest_is_refused(self):
        code, out, err = self.run_main(
            *self.arguments("--expected-tool-sha256", "NOT-A-DIGEST"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("expected_digest_format", err)

    def test_failed_link_leaves_no_staging_or_destination(self):
        with mock.patch.object(provision.os, "link",
                               side_effect=OSError(13, "synthetic denial")):
            code, out, err = self.run_main(*self.arguments("--apply",
                                                           "--publish-tool"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("io_error", err)
        self.assertEqual(self.entries(), [])

    def test_staging_name_is_never_reused(self):
        code, _, err = self.run_main(*self.arguments("--apply", "--publish-tool"))
        self.assertEqual(code, 0, err)
        self.assertFalse([name for name in self.entries()
                          if name.startswith(".") and "staging" in name])

    def test_unsupported_atomic_link_is_refused_without_copying(self):
        with mock.patch.object(provision.os, "link",
                               side_effect=NotImplementedError):
            code, out, err = self.run_main(*self.arguments("--apply",
                                                           "--publish-tool"))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("atomic_link_unsupported", err)
        self.assertEqual(self.entries(), [])
    def test_lock_is_kept_when_a_later_publish_fails(self):
        destination = self.private / TOOL
        destination.write_bytes(b"existing reviewed copy\n")
        os.chmod(destination, 0o600)
        code, out, err = self.run_main(*self.arguments("--apply", "--create-lock",
                                                       "--publish-tool"))
        self.assertEqual(code, 1)
        self.assertIn("APPLY action=create-lock", out)
        self.assertNotIn("RESULT PROVISIONED", out)
        self.assertIn("tool_destination_exists", err)
        self.assert_private_regular_single_link(self.private / LOCK)
        self.assertEqual(self.entries(), sorted([LOCK, TOOL]))

    def test_destination_name_cannot_traverse(self):
        for name in ("../escape", "nested/tool.py", ".hidden", ""):
            code, out, err = self.run_main(*self.arguments("--apply",
                                                           "--publish-tool",
                                                           "--name", name))
            self.assertEqual((code, out), (1, ""), name)
            self.assertIn("destination_name", err)
        self.assertEqual(self.entries(), [])

    def test_reserved_lock_name_cannot_be_used_for_the_tool(self):
        code, out, err = self.run_main(*self.arguments("--apply", "--publish-tool",
                                                       "--name", LOCK))
        self.assertEqual((code, out), (1, ""))
        self.assertIn("destination_name", err)
        self.assertEqual(self.entries(), [])

    def test_tool_source_symlink_is_refused(self):
        linked = self.base / "linked_tool.py"
        linked.symlink_to(self.tool)
        code, out, err = self.run_main("--tool", str(linked), "--private",
                                       str(self.private), "--app-root",
                                       str(self.app_root), "--apply", "--publish-tool")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("tool_symlink", err)
        self.assertEqual(self.entries(), [])

    def test_tool_source_directory_is_refused(self):
        directory = self.base / "tool_directory"
        directory.mkdir(mode=0o700)
        code, out, err = self.run_main("--tool", str(directory), "--private",
                                       str(self.private), "--app-root",
                                       str(self.app_root), "--apply", "--publish-tool")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("tool_not_regular", err)
        self.assertEqual(self.entries(), [])

    def test_relative_paths_are_refused(self):
        code, out, err = self.run_main("--tool", "reviewed_tool.py", "--private",
                                       "private", "--app-root", "app", "--apply",
                                       "--create-lock")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("absolute_path_required", err)

    def test_noncanonical_paths_are_refused(self):
        code, out, err = self.run_main(
            "--tool", str(self.tool), "--private", str(self.private) + "/.",
            "--app-root", str(self.app_root), "--apply", "--create-lock")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("noncanonical_private", err)
        self.assertEqual(self.entries(), [])

    def test_noncanonical_tool_path_is_refused(self):
        code, out, err = self.run_main(
            "--tool", str(self.base) + "//reviewed_tool.py", "--private",
            str(self.private), "--app-root", str(self.app_root), "--apply",
            "--publish-tool")
        self.assertEqual((code, out), (1, ""))
        self.assertIn("noncanonical_tool", err)
        self.assertEqual(self.entries(), [])

    def test_no_built_in_destination_exists(self):
        self.assertFalse(hasattr(provision, "PRODUCTION"))
        code, out, err = self.run_main(*self.arguments())
        self.assertEqual((code, err), (0, ""))
        self.assertIn("RESULT PLAN_ONLY_NO_WRITES", out)
        self.assertEqual(self.entries(), [])

    def test_application_root_overlap_is_refused(self):
        nested = self.private / "nested"
        nested.mkdir(mode=0o700)
        under_root = self.app_root / "sub" / "private"
        under_root.mkdir(parents=True, mode=0o700)
        for private, root in ((self.private, self.private),
                              (nested, self.private),
                              (self.private, nested),
                              (under_root, self.app_root)):
            code, out, err = self.run_main(
                "--tool", str(self.tool), "--private", str(private),
                "--app-root", str(root), "--apply", "--create-lock")
            self.assertEqual((code, out), (1, ""), (private, root))
            self.assertIn("private_boundary", err)
        self.assertEqual(self.entries(), ["nested"])
        self.assertEqual(os.listdir(nested), [])
        self.assertEqual(os.listdir(under_root), [])

    def test_application_root_is_required(self):
        with self.assertRaises(SystemExit) as raised:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                provision.main(["--tool", str(self.tool), "--private",
                                str(self.private)])
        self.assertEqual(raised.exception.code, 2)
        self.assertEqual(self.entries(), [])


if __name__ == "__main__":
    unittest.main()
