using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecurePaste.Modules.Pastes.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "pastes");

            migrationBuilder.CreateTable(
                name: "pastes",
                schema: "pastes",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    ciphertext = table.Column<byte[]>(type: "bytea", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    max_views = table.Column<int>(type: "integer", nullable: true),
                    views_used = table.Column<int>(type: "integer", nullable: false),
                    destroyed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    delete_token_hash = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pastes", x => x.id);
                    table.CheckConstraint("ck_ciphertext_size", "ciphertext IS NULL OR octet_length(ciphertext) <= 270000");
                    table.CheckConstraint("ck_max_views_positive", "max_views IS NULL OR max_views > 0");
                    table.CheckConstraint("ck_tombstone_pairing", "(ciphertext IS NULL) = (destroyed_at IS NOT NULL)");
                    table.CheckConstraint("ck_views_within_limit", "max_views IS NULL OR views_used <= max_views");
                });

            migrationBuilder.CreateIndex(
                name: "ix_pastes_expires_at",
                schema: "pastes",
                table: "pastes",
                column: "expires_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pastes",
                schema: "pastes");
        }
    }
}
