using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Infrastructure;

internal sealed class PasteEntityConfiguration : IEntityTypeConfiguration<Paste>
{
    public void Configure(EntityTypeBuilder<Paste> builder)
    {
        builder.ToTable("pastes", table =>
        {
            table.HasCheckConstraint(
                "ck_max_views_positive",
                "max_views IS NULL OR max_views > 0");
            table.HasCheckConstraint(
                "ck_views_within_limit",
                "max_views IS NULL OR views_used <= max_views");
            table.HasCheckConstraint(
                "ck_tombstone_pairing",
                "(ciphertext IS NULL) = (destroyed_at IS NOT NULL)");
            table.HasCheckConstraint(
                "ck_ciphertext_size",
                "ciphertext IS NULL OR octet_length(ciphertext) <= 270000");
        });

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnName("id")
            .HasColumnType("text")
            .HasConversion(id => id.Value, value => PasteId.FromTrusted(value));

        builder.Property(p => p.Ciphertext)
            .HasColumnName("ciphertext");

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(p => p.ExpiresAt)
            .HasColumnName("expires_at");

        builder.Property(p => p.MaxViews)
            .HasColumnName("max_views");

        builder.Property(p => p.ViewsUsed)
            .HasColumnName("views_used");

        builder.Property(p => p.DestroyedAt)
            .HasColumnName("destroyed_at");

        builder.Property(p => p.DeleteTokenHash)
            .HasColumnName("delete_token_hash")
            .HasConversion(hash => hash.ToByteArray(), bytes => DeleteTokenHash.FromHash(bytes));

        builder.HasIndex(p => p.ExpiresAt)
            .HasDatabaseName("ix_pastes_expires_at");
    }
}
