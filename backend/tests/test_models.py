"""
FinBank Unit Tests — Pydantic Model Validation

Tests that all request/response models enforce correct types,
constraints, and validation rules as documented in the assignment.
"""
import pytest
from pydantic import ValidationError
from app.models.user import UserRegisterRequest, UserLoginRequest, UserRole
from app.models.account import AccountCreateRequest, AccountType
from app.models.transaction import (
    DepositRequest,
    WithdrawRequest,
    TransferRequest,
)


# ═══════════════════════════════════════════
#  User Registration Model
# ═══════════════════════════════════════════


class TestUserRegisterRequest:
    """Validate user registration input constraints."""

    @staticmethod
    def _valid_payload(**overrides):
        payload = {
            "email": "user@example.com",
            "password": "securepass123",
            "full_name": "Test User",
            "phone": "+905551112233",
            "national_id": "10000000146",
        }
        payload.update(overrides)
        return payload

    def test_valid_registration(self):
        """Accept valid email + password ≥ 8 chars."""
        req = UserRegisterRequest(**self._valid_payload())
        assert req.email == "user@example.com"
        assert req.password == "securepass123"
        assert req.full_name == "Test User"

    def test_invalid_email_format(self):
        """Reject invalid email format."""
        with pytest.raises(ValidationError):
            UserRegisterRequest(**self._valid_payload(email="not-an-email"))

    def test_password_too_short(self):
        """Reject password shorter than 8 characters."""
        with pytest.raises(ValidationError):
            UserRegisterRequest(**self._valid_payload(password="short"))

    def test_missing_email(self):
        """Reject missing email field."""
        with pytest.raises(ValidationError):
            payload = self._valid_payload()
            payload.pop("email")
            UserRegisterRequest(**payload)

    def test_missing_password(self):
        """Reject missing password field."""
        with pytest.raises(ValidationError):
            payload = self._valid_payload()
            payload.pop("password")
            UserRegisterRequest(**payload)


# ═══════════════════════════════════════════
#  User Login Model
# ═══════════════════════════════════════════


class TestUserLoginRequest:
    """Validate login request constraints."""

    def test_valid_login(self):
        """Accept valid email and password."""
        req = UserLoginRequest(
            email="user@example.com",
            password="password123",
        )
        assert req.email == "user@example.com"

    def test_invalid_email(self):
        """Reject invalid email on login."""
        with pytest.raises(ValidationError):
            UserLoginRequest(email="bad-email", password="password123")


# ═══════════════════════════════════════════
#  User Roles Enum
# ═══════════════════════════════════════════


class TestUserRole:
    """Verify role enum values match RBAC requirements."""

    def test_role_values(self):
        """All required roles exist."""
        assert UserRole.ADMIN == "admin"
        assert UserRole.CUSTOMER == "customer"
        assert UserRole.EMPLOYEE == "employee"
        assert UserRole.CEO == "ceo"


# ═══════════════════════════════════════════
#  Account Model
# ═══════════════════════════════════════════


class TestAccountCreateRequest:
    """Validate account creation input."""

    def test_default_account(self):
        """Default account type is checking, currency is TRY."""
        req = AccountCreateRequest()
        assert req.account_type == AccountType.CHECKING
        assert req.currency == "TRY"

    def test_savings_account(self):
        """Accept savings account type."""
        req = AccountCreateRequest(account_type="savings", currency="USD")
        assert req.account_type == AccountType.SAVINGS
        assert req.currency == "USD"

    def test_invalid_currency_format(self):
        """Reject currency not matching 3-letter uppercase pattern."""
        with pytest.raises(ValidationError):
            AccountCreateRequest(currency="try")  # lowercase

    def test_invalid_currency_length(self):
        """Reject currency with wrong length."""
        with pytest.raises(ValidationError):
            AccountCreateRequest(currency="TRYX")


# ═══════════════════════════════════════════
#  Transaction Models (Deposit / Withdraw / Transfer)
# ═══════════════════════════════════════════


class TestDepositRequest:
    """Validate deposit request constraints."""

    def test_valid_deposit(self):
        """Accept valid deposit."""
        req = DepositRequest(account_id="ACC-001", amount=500.50)
        assert req.amount == 500.50

    def test_zero_amount_rejected(self):
        """Reject zero deposit amount."""
        with pytest.raises(ValidationError):
            DepositRequest(account_id="ACC-001", amount=0)

    def test_negative_amount_rejected(self):
        """Reject negative deposit amount."""
        with pytest.raises(ValidationError):
            DepositRequest(account_id="ACC-001", amount=-100)

    def test_exceeds_maximum(self):
        """Reject deposit exceeding 1,000,000 limit."""
        with pytest.raises(ValidationError):
            DepositRequest(account_id="ACC-001", amount=1_000_001)


class TestWithdrawRequest:
    """Validate withdrawal request constraints."""

    def test_valid_withdrawal(self):
        """Accept valid withdrawal."""
        req = WithdrawRequest(account_id="ACC-001", amount=200.0)
        assert req.amount == 200.0

    def test_zero_amount_rejected(self):
        """Reject zero withdrawal."""
        with pytest.raises(ValidationError):
            WithdrawRequest(account_id="ACC-001", amount=0)


class TestTransferRequest:
    """Validate transfer request constraints."""

    def test_valid_transfer(self):
        """Accept valid transfer between different accounts."""
        req = TransferRequest(
            from_account_id="ACC-001",
            to_account_id="ACC-002",
            amount=1000.0,
        )
        assert req.from_account_id == "ACC-001"
        assert req.to_account_id == "ACC-002"

    def test_missing_from_account(self):
        """Reject transfer without source account."""
        with pytest.raises(ValidationError):
            TransferRequest(to_account_id="ACC-002", amount=100)

    def test_exceeds_maximum(self):
        """Reject transfer exceeding 1,000,000."""
        with pytest.raises(ValidationError):
            TransferRequest(
                from_account_id="ACC-001",
                to_account_id="ACC-002",
                amount=2_000_000,
            )
