def mask_sensitive(value):
    """
    Mask sensitive values while keeping the last four characters for debugging.

    Examples:
    - None -> ""
    - "abcd" -> "****"
    - "abcdefgh" -> "****efgh"
    """
    if value is None:
        return ""

    text = str(value)
    if not text:
        return ""

    if len(text) <= 4:
        return "*" * len(text)

    return f"{'*' * (len(text) - 4)}{text[-4:]}"
