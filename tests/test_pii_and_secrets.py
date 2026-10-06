import pickle

import pytest

from guardrails import MaskingVault, known_secrets, masker


@pytest.mark.parametrize(
    "text, raw, placeholder",
    [
        ("Send an email to john.doe@gmail.com", "john.doe@gmail.com", "[EMAIL_REDACTED]"),
        ("Call +91 9876543210 today", "9876543210", "[PHONE_REDACTED]"),
        ("Mobile: 98765 43210", "98765 43210", "[PHONE_REDACTED]"),
        ("US office (415) 555-0132", "555-0132", "[PHONE_REDACTED]"),
        ("Aadhaar 1234 5678 9012", "1234 5678 9012", "[AADHAAR_REDACTED]"),
        ("uid 499118665246", "499118665246", "[AADHAAR_REDACTED]"),  # Verhoeff-valid, no spaces
        ("PAN: ABCDE1234F", "ABCDE1234F", "[PAN_REDACTED]"),
        ("pan AAAPL1234C", "AAAPL1234C", "[PAN_REDACTED]"),
        ("Card 4111 1111 1111 1111", "4111 1111 1111 1111", "[CARD_REDACTED]"),
        ("cc 5500-0000-0000-0004", "5500-0000-0000-0004", "[CARD_REDACTED]"),
        ("Bank account number: 123456789012", "123456789012", "[BANK_ACCOUNT_REDACTED]"),
        ("IBAN GB82 WEST 1234 5698 7654 32", "GB82 WEST 1234 5698 7654 32", "[BANK_ACCOUNT_REDACTED]"),
        ("Pay to john@okaxis please", "john@okaxis", "[UPI_REDACTED]"),
        ("UPI: shop.owner@freshbank", "shop.owner@freshbank", "[UPI_REDACTED]"),
        ("server 192.168.10.25 is down", "192.168.10.25", "[IP_REDACTED]"),
        ("Request came from 49.36.12.7.", "49.36.12.7", "[IP_REDACTED]"),  # end of sentence
        ("ipv6 2001:db8:85a3::8a2e:370:7334 ok", "2001:db8:85a3::8a2e:370:7334", "[IP_REDACTED]"),
        ("Passport number: K8574931", "K8574931", "[PASSPORT_REDACTED]"),
        ("SSN 123-45-6789", "123-45-6789", "[GOV_ID_REDACTED]"),
        ("Voter ID ABC1234567", "ABC1234567", "[GOV_ID_REDACTED]"),
        ("My name is Priya Raman", "Priya Raman", "[NAME_REDACTED]"),
        ("Assigned to Dr. Arjun Mehta", "Arjun Mehta", "[NAME_REDACTED]"),
        ("I live at 221B Baker Street, London", "221B Baker Street", "[ADDRESS_REDACTED]"),
        ("Address: Flat 12, Green Park, Pune", "Flat 12, Green Park, Pune", "[ADDRESS_REDACTED]"),
    ],
)
def test_pii_is_detected_and_masked(text, raw, placeholder):
    result = masker.mask(text)
    assert raw not in result.text
    assert placeholder in result.text


@pytest.mark.parametrize(
    "text, raw, placeholder",
    [
        ("key sk-xxxxxxxxxxxxxxxx", "sk-xxxxxxxxxxxxxxxx", "[API_KEY_REDACTED]"),
        ("groq gsk_abcDEF1234567890ghijKLMN", "gsk_abcDEF1234567890ghijKLMN", "[API_KEY_REDACTED]"),
        ("google AIzaSyA1234567890abcdefghijklmnopqrstuv", "AIzaSyA1234567890abcdefghijklmnopqrstuv", "[API_KEY_REDACTED]"),
        ("aws AKIAIOSFODNN7EXAMPLE", "AKIAIOSFODNN7EXAMPLE", "[API_KEY_REDACTED]"),
        ("api_key=AbC123xyz789QQ", "AbC123xyz789QQ", "[API_KEY_REDACTED]"),
        (
            "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
            "[TOKEN_REDACTED]",
        ),
        ("Authorization: Bearer abcdef0123456789ABCDEFxyz", "abcdef0123456789ABCDEFxyz", "[TOKEN_REDACTED]"),
        ("access_token: 9f8e7d6c5b4aZZ", "9f8e7d6c5b4aZZ", "[TOKEN_REDACTED]"),
        ("Cookie sessionid=abc123def456ghi789", "abc123def456ghi789", "[SESSION_TOKEN_REDACTED]"),
        ("login password: Hunter2!x", "Hunter2!x", "[PASSWORD_REDACTED]"),
        ("the password is S3cure#Pass", "S3cure#Pass", "[PASSWORD_REDACTED]"),
        ("PIN: 4821", "4821", "[PASSWORD_REDACTED]"),
        (
            "db postgresql://admin:S3cret@db.internal:5432/bugmind",
            "postgresql://admin:S3cret@db.internal:5432/bugmind",
            "[CONNECTION_STRING_REDACTED]",
        ),
        (
            "DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=abc123XYZ==;EndpointSuffix=core.windows.net",
            "AccountKey=abc123XYZ==",
            "[CONNECTION_STRING_REDACTED]",
        ),
        ("https://bob:pa55word@internal.example.org/x", "pa55word", "[PASSWORD_REDACTED]"),
        (
            "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234\n-----END RSA PRIVATE KEY-----",
            "MIIEpAIBAAKCAQEA1234",
            "[PRIVATE_KEY_REDACTED]",
        ),
    ],
)
def test_secrets_are_detected_and_redacted(text, raw, placeholder):
    result = masker.mask(text)
    assert raw not in result.text
    assert placeholder in result.text


@pytest.mark.parametrize(
    "text",
    [
        "User enters password and clicks Login.",
        "Password is required and must be at least 8 characters.",
        "Release 2.1.0 shipped on 2024-01-15 at 10:30.",
        "Order ID 20240115123045 was created.",
        "Field name: Email Address must be unique.",
        "Commit 3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39 fixes the build",
        "Request id 550e8400-e29b-41d4-a716-446655440000",
        "The token: required header is missing",
        "Summarize this document.",
        "Analyze these sales numbers: 1200, 3400, 5600.",
        "Test pass rate was 98% across 1500 runs.",
    ],
)
def test_ordinary_qa_text_is_not_masked(text):
    assert masker.mask(text).text == text


def test_masking_preserves_sentence_context():
    result = masker.mask("Send an email to john.doe@gmail.com and call 9876543210 after review.")
    assert result.text == "Send an email to [EMAIL_REDACTED] and call [PHONE_REDACTED] after review."
    assert result.entity_counts == {"EMAIL": 1, "PHONE": 1}


def test_indexed_style_keeps_distinct_values_distinct(set_env):
    set_env(PII_MASK_STYLE="indexed")
    text = "a@corp.io wrote to b@corp.io, then a@corp.io replied"
    assert masker.mask(text).text == "[EMAIL_1] wrote to [EMAIL_2], then [EMAIL_1] replied"


def test_vault_is_reversible_scoped_and_unserializable():
    with MaskingVault() as vault:
        masked = masker.mask("Contact Priya at priya@corp.io", vault=vault)
        assert "priya@corp.io" not in masked.text
        assert "[EMAIL_1]" in masked.text
        assert vault.unmask(masked.text) == "Contact Priya at priya@corp.io"
        assert "priya" not in repr(vault).lower()
        with pytest.raises(TypeError):
            pickle.dumps(vault)
    assert len(vault) == 0  # wiped on exit


def test_secrets_never_enter_the_vault():
    with MaskingVault() as vault:
        masked = masker.mask("key sk-proj-abcdefghij1234567890", vault=vault)
        assert "[API_KEY_REDACTED]" in masked.text
        assert len(vault) == 0


def test_pii_entities_can_be_disabled_but_secrets_cannot(set_env):
    set_env(PII_DISABLED_ENTITIES="EMAIL,API_KEY")
    result = masker.mask("mail a@corp.io key sk-abcdefghijklmnop1234")
    assert "a@corp.io" in result.text
    assert "[API_KEY_REDACTED]" in result.text


def test_known_runtime_secret_is_redacted_even_without_a_known_format(monkeypatch):
    monkeypatch.setenv("PAYMENTS_SIGNING_SECRET", "plainButSecretValue42")
    assert masker.mask("config dump: plainButSecretValue42").text == "config dump: [SECRET_REDACTED]"

    known_secrets.register("userByokKey9876ZYX")
    assert "userByokKey9876ZYX" not in masker.mask("echo userByokKey9876ZYX").text


def test_mask_obj_walks_nested_structures():
    data = {"rows": [{"email": "x@corp.io", "n": 5}, ("call 9876543210",)], "ok": True}
    masked, counts = masker.mask_obj(data)
    assert masked == {"rows": [{"email": "[EMAIL_REDACTED]", "n": 5}, ("call [PHONE_REDACTED]",)], "ok": True}
    assert counts == {"EMAIL": 1, "PHONE": 1}
