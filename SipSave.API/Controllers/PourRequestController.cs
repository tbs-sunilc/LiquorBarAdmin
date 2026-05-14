using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.PourRequests;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-22..25 pour-request lifecycle.  End-user submits from SC-22, bartender
/// tablet resolves from SC-22/SC-23.  All real-time fan-out runs through
/// <see cref="SipSave.API.Hubs.PourHub"/> — the controller touches HTTP only.
///
/// Role model:
///   * End users authenticate with the default scheme (no staff role claim).
///   * Bartender tablets sign in through the Phase-8 staff-login flow which
///     mints a token carrying <c>ClaimTypes.Role = "staff"</c>.  That role gate
///     guards the Serve + Queue endpoints.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/pour-requests")]
[Produces("application/json")]
public sealed class PourRequestController : ControllerBase
{
    private const string StaffRole = "staff";

    private readonly IPourRequestService _pours;

    public PourRequestController(IPourRequestService pours)
    {
        _pours = pours;
    }

    /// <summary>POST /api/v1/pour-requests — SC-22 end-user "Pour a bottle" submit.
    /// Returns 422 when BR-005 is violated (see <c>InsufficientWalletBalanceException</c>).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PourRequestDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<PourRequestDto>> Create(
        [FromBody] CreatePourRequest request,
        CancellationToken ct)
    {
        var pour = await _pours.CreateAsync(request, GetCallerId(), ct);
        return CreatedAtAction(nameof(Get), new { id = pour.Id }, pour);
    }

    /// <summary>PUT /api/v1/pour-requests/:id/serve — bartender SC-22 "Serve X ml" tap.
    /// CLAUDE-Rule-1: runs <c>sp_DeductWallet</c> atomically.</summary>
    [HttpPut("{id:int}/serve")]
    [Authorize(Roles = StaffRole)]
    [ProducesResponseType(typeof(PourRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<PourRequestDto>> Serve(
        int id,
        [FromBody] ServePourRequest request,
        CancellationToken ct)
    {
        var pour = await _pours.ServeAsync(id, request, GetCallerId(), ct);
        return Ok(pour);
    }

    /// <summary>PUT /api/v1/pour-requests/:id/cancel — user self-cancel OR bartender
    /// reject (role-dependent).  Fans out PourCancelled to the user group.</summary>
    [HttpPut("{id:int}/cancel")]
    [ProducesResponseType(typeof(PourRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PourRequestDto>> Cancel(
        int id,
        [FromBody] CancelPourRequest request,
        CancellationToken ct)
    {
        var pour = await _pours.CancelAsync(id, request, GetCallerId(), IsStaff(), ct);
        return Ok(pour);
    }

    /// <summary>GET /api/v1/pour-requests/queue?barId=… — bartender SC-22 queue fetch.</summary>
    [HttpGet("queue")]
    [Authorize(Roles = StaffRole)]
    [ProducesResponseType(typeof(IReadOnlyList<PourRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<PourRequestDto>>> Queue(
        [FromQuery] int barId,
        CancellationToken ct)
    {
        var rows = await _pours.GetBarQueueAsync(barId, GetCallerId(), ct);
        return Ok(rows);
    }

    /// <summary>GET /api/v1/pour-requests/:id — single detail, used by SC-23/24/25.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PourRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PourRequestDto>> Get(int id, CancellationToken ct)
    {
        var pour = await _pours.GetByIdAsync(id, GetCallerId(), IsStaff(), ct);
        return pour is null ? NotFound() : Ok(pour);
    }

    // -----------------------------------------------------------------------
    //  helpers
    // -----------------------------------------------------------------------
    private int GetCallerId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }

    private bool IsStaff() => User.IsInRole(StaffRole);
}
