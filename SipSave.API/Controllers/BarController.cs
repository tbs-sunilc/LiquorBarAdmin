using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Bars;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Section 3 Module B endpoints. Controller stays thin — every rule
/// (BR-006..011, admin state transitions, owner-only gates) is enforced in
/// <see cref="IBarService"/>; exceptions flow through <c>GlobalExceptionMiddleware</c>.
/// </summary>
[ApiController]
[Route("api/v1/bars")]
[Produces("application/json")]
public sealed class BarController : ControllerBase
{
    private const string AdminRole = "Admin";

    private readonly IBarService _bars;
    private readonly IQrCodeService _qr;

    public BarController(IBarService bars, IQrCodeService qr)
    {
        _bars = bars;
        _qr = qr;
    }

    // =========================================================================
    //  Discovery (SC-10 / SC-11) — authenticated end users (or anonymous for Phase 3 MVP)
    // =========================================================================

    /// <summary>GET /api/v1/bars — geo + tag + text discovery.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BarListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<BarListResponse>> Discover(
        [FromQuery] decimal? lat,
        [FromQuery] decimal? lng,
        [FromQuery] double? radiusKm,
        [FromQuery] string? city,
        [FromQuery] string? userStateCode,
        [FromQuery(Name = "tags")] string? tagsCsv,
        [FromQuery] string? q,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var tags = string.IsNullOrWhiteSpace(tagsCsv)
            ? null
            : tagsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var query = new BarDiscoveryQuery(
            Lat:           lat,
            Lng:           lng,
            RadiusKm:      radiusKm,
            City:          city,
            UserStateCode: userStateCode,
            Tags:          tags,
            Q:             q,
            Skip:          skip,
            Take:          take);

        var response = await _bars.DiscoverAsync(query, TryGetUserId(), ct);
        return Ok(response);
    }

    /// <summary>GET /api/v1/bars/{id} — SC-12 bar profile.</summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BarProfileDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BarProfileDetailDto>> GetProfile(int id, CancellationToken ct)
    {
        var response = await _bars.GetProfileAsync(id, TryGetUserId(), ct);
        return Ok(response);
    }

    // =========================================================================
    //  Bar-owner registration (SC-02 / SC-03)
    // =========================================================================

    /// <summary>POST /api/v1/bars — Prototype 2 SC-02 step 1 submission.</summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(BarRegistrationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<BarRegistrationResponse>> Register(
        [FromBody] BarRegistrationRequest request,
        CancellationToken ct)
    {
        var response = await _bars.RegisterAsync(request, GetUserId(), ct);
        return CreatedAtAction(nameof(GetProfile), new { id = response.BarId }, response);
    }

    /// <summary>POST /api/v1/bars/{id}/documents — Prototype 2 SC-03 four-doc submission.</summary>
    [HttpPost("{id:int}/documents")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetDocuments(
        int id,
        [FromBody] BarDocumentsRequest request,
        CancellationToken ct)
    {
        await _bars.SetDocumentsAsync(id, request, GetUserId(), ct);
        return NoContent();
    }

    /// <summary>PUT /api/v1/bars/{id} — bar owner profile edit.</summary>
    [HttpPut("{id:int}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] BarUpdateRequest request,
        CancellationToken ct)
    {
        await _bars.UpdateAsync(id, request, GetUserId(), ct);
        return NoContent();
    }

    // =========================================================================
    //  Admin
    // =========================================================================

    /// <summary>PUT /api/v1/bars/{id}/status — Approve / Reject / Suspend / Reinstate.</summary>
    [HttpPut("{id:int}/status")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdminSetStatus(
        int id,
        [FromBody] BarAdminStatusRequest request,
        CancellationToken ct)
    {
        await _bars.AdminSetStatusAsync(id, request, GetUserId(), ct);
        return NoContent();
    }

    // =========================================================================
    //  Tables + QR codes (owner)
    // =========================================================================

    /// <summary>POST /api/v1/bars/{id}/tables — bulk create with auto-generated QR tokens.</summary>
    [HttpPost("{id:int}/tables")]
    [Authorize]
    [ProducesResponseType(typeof(IReadOnlyList<BarTableDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<BarTableDto>>> CreateTables(
        int id,
        [FromBody] CreateBarTablesRequest request,
        CancellationToken ct)
    {
        var created = await _qr.CreateTablesAsync(id, request, GetUserId(), ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>GET /api/v1/bars/{id}/tables — owner reads own table list.</summary>
    [HttpGet("{id:int}/tables")]
    [Authorize]
    [ProducesResponseType(typeof(IReadOnlyList<BarTableDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BarTableDto>>> ListTables(int id, CancellationToken ct)
    {
        var tables = await _qr.ListTablesAsync(id, GetUserId(), ct);
        return Ok(tables);
    }

    /// <summary>GET /api/v1/bars/{id}/qr-codes — printable A4 PDF bundle of every table's QR.</summary>
    [HttpGet("{id:int}/qr-codes")]
    [Authorize]
    [Produces("application/pdf")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadQrBundle(int id, CancellationToken ct)
    {
        var pdf = await _qr.GenerateQrBundlePdfAsync(id, GetUserId(), ct);
        return File(pdf, "application/pdf", $"sipsave-table-qr-codes-bar-{id}.pdf");
    }

    // -----------------------------------------------------------------------
    //  helpers
    // -----------------------------------------------------------------------
    private int GetUserId()
    {
        var id = TryGetUserId();
        if (id is null)
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id.Value;
    }

    private int? TryGetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : (int?)null;
    }
}
