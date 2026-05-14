using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Sessions;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-11 QR check-in, SC-21 active-session screen, and SC-26 self check-out.
/// BR-021 (one active session per user) and BR-022 (6-hour idle auto-close) are
/// enforced in <see cref="ISessionService"/>; this controller stays thin.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/sessions")]
[Produces("application/json")]
public sealed class SessionController : ControllerBase
{
    private readonly ISessionService _sessions;

    public SessionController(ISessionService sessions)
    {
        _sessions = sessions;
    }

    /// <summary>POST /api/v1/sessions/check-in — SC-11 QR scan → create / update BAR_SESSION.</summary>
    [HttpPost("check-in")]
    [ProducesResponseType(typeof(SessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SessionDto>> CheckIn(
        [FromBody] CheckInRequest request,
        CancellationToken ct)
    {
        var session = await _sessions.CheckInAsync(request, GetUserId(), ct);
        return Ok(session);
    }

    /// <summary>POST /api/v1/sessions/:id/check-out — SC-26 user-initiated close.</summary>
    [HttpPost("{id:int}/check-out")]
    [ProducesResponseType(typeof(SessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SessionDto>> CheckOut(int id, CancellationToken ct)
    {
        var session = await _sessions.CheckOutAsync(id, GetUserId(), ct);
        return Ok(session);
    }

    /// <summary>GET /api/v1/sessions/active — SC-21 screen load. 204 when no active session.</summary>
    [HttpGet("active")]
    [ProducesResponseType(typeof(SessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<SessionDto>> GetActive(CancellationToken ct)
    {
        var session = await _sessions.GetActiveAsync(GetUserId(), ct);
        return session is null ? NoContent() : Ok(session);
    }

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
