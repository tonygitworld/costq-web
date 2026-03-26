"""管理后台清理验证测试。

验证从 costq-web 中清理管理后台代码后，
已删除的文件/目录不存在、保留的文件仍然存在、
后端和前端代码中不包含已清理的引用。
"""

from pathlib import Path

# costq-web 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent


# ============================================================
# 7.1 文件存在性断言
# ============================================================


class TestDeletedFilesNotExist:
    """验证已删除的文件和目录不存在。"""

    def test_ops_api_directory_deleted(self) -> None:
        assert not (PROJECT_ROOT / "backend" / "api" / "ops").exists()

    def test_ops_components_directory_deleted(self) -> None:
        assert not (PROJECT_ROOT / "frontend" / "src" / "components" / "ops").exists()

    def test_ops_service_deleted(self) -> None:
        assert not (PROJECT_ROOT / "frontend" / "src" / "services" / "opsService.ts").exists()

    def test_super_admin_route_deleted(self) -> None:
        assert not (PROJECT_ROOT / "frontend" / "src" / "routes" / "SuperAdminRoute.tsx").exists()

    def test_ops_json_zh_cn_deleted(self) -> None:
        assert not (
            PROJECT_ROOT / "frontend" / "src" / "i18n" / "locales" / "zh-CN" / "ops.json"
        ).exists()

    def test_ops_json_en_us_deleted(self) -> None:
        assert not (
            PROJECT_ROOT / "frontend" / "src" / "i18n" / "locales" / "en-US" / "ops.json"
        ).exists()

    def test_ops_json_ja_jp_deleted(self) -> None:
        assert not (
            PROJECT_ROOT / "frontend" / "src" / "i18n" / "locales" / "ja-JP" / "ops.json"
        ).exists()


class TestPreservedFilesExist:
    """验证保留的文件仍然存在。"""

    def test_audit_logger_preserved(self) -> None:
        assert (PROJECT_ROOT / "backend" / "services" / "audit_logger.py").exists()

    def test_audit_log_model_preserved(self) -> None:
        assert (PROJECT_ROOT / "backend" / "models" / "audit_log.py").exists()

    def test_auth_utils_preserved(self) -> None:
        assert (PROJECT_ROOT / "backend" / "utils" / "auth.py").exists()

    def test_users_api_preserved(self) -> None:
        assert (PROJECT_ROOT / "backend" / "api" / "users.py").exists()

    def test_user_management_preserved(self) -> None:
        assert (
            PROJECT_ROOT / "frontend" / "src" / "components" / "user" / "UserManagement.tsx"
        ).exists()

    def test_cloud_account_management_preserved(self) -> None:
        assert (
            PROJECT_ROOT
            / "frontend"
            / "src"
            / "components"
            / "settings"
            / "CloudAccountManagement.tsx"
        ).exists()


# ============================================================
# 7.2 后端代码内容断言
# ============================================================


class TestBackendCodeContent:
    """验证后端代码中不包含已清理的引用，且保留必要的功能。"""

    def test_main_py_no_ops_router(self) -> None:
        content = (PROJECT_ROOT / "backend" / "main.py").read_text()
        assert "ops_router" not in content

    def test_auth_no_super_admin_emails(self) -> None:
        content = (PROJECT_ROOT / "backend" / "utils" / "auth.py").read_text()
        assert "SUPER_ADMIN_EMAILS" not in content

    def test_auth_no_get_current_super_admin(self) -> None:
        content = (PROJECT_ROOT / "backend" / "utils" / "auth.py").read_text()
        assert "get_current_super_admin" not in content

    def test_auth_preserves_get_current_user(self) -> None:
        content = (PROJECT_ROOT / "backend" / "utils" / "auth.py").read_text()
        assert "get_current_user" in content

    def test_auth_preserves_get_current_admin_user(self) -> None:
        content = (PROJECT_ROOT / "backend" / "utils" / "auth.py").read_text()
        assert "get_current_admin_user" in content

    def test_audit_logger_no_log_tenant_delete(self) -> None:
        content = (PROJECT_ROOT / "backend" / "services" / "audit_logger.py").read_text()
        assert "log_tenant_delete" not in content


# ============================================================
# 7.3 前端代码内容断言
# ============================================================


class TestFrontendCodeContent:
    """验证前端代码中不包含已清理的引用。"""

    def test_app_tsx_no_ops_route(self) -> None:
        content = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text()
        assert "/ops/" not in content

    def test_app_tsx_no_super_admin_route_import(self) -> None:
        content = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text()
        assert "SuperAdminRoute" not in content

    def test_settings_menu_no_is_super_admin(self) -> None:
        content = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "sidebar" / "SettingsMenu.tsx"
        ).read_text()
        assert "isSuperAdmin" not in content

    def test_mobile_settings_no_is_super_admin(self) -> None:
        content = (
            PROJECT_ROOT
            / "frontend"
            / "src"
            / "components"
            / "layout"
            / "MobileSettingsPage.tsx"
        ).read_text()
        assert "isSuperAdmin" not in content

    def test_auth_store_no_super_admin_emails(self) -> None:
        content = (
            PROJECT_ROOT / "frontend" / "src" / "stores" / "authStore.ts"
        ).read_text()
        assert "SUPER_ADMIN_EMAILS" not in content

    def test_auth_store_no_is_super_admin(self) -> None:
        content = (
            PROJECT_ROOT / "frontend" / "src" / "stores" / "authStore.ts"
        ).read_text()
        assert "isSuperAdmin" not in content
