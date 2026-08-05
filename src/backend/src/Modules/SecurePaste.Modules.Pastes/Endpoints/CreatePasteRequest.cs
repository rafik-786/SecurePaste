namespace SecurePaste.Modules.Pastes.Endpoints;

public sealed record CreatePasteRequest(string? Ciphertext, int ExpiresInSeconds, int? MaxViews);
