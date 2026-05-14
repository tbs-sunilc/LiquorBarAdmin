using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Per-user notification preferences.  SC-29 has a settings entry for
/// turning individual event types on or off; the dispatcher consults these
/// flags before firing FCM / WATI.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/notifications/preferences")]
[Produces("application/json")]
public sealed class NotificationPreferenceController : ControllerBase
{
    private readonly INotificationPreferenceStore _store;

    public NotificationPreferenceController(INotificationPreferenceStore store)
    {
        _store = store;
    }

    [HttpGet]
    [ProducesResponseType(typeof(NotificationPreferences), StatusCodes.Status200OK)]
    public async Task<ActionResult<NotificationPreferences>> Get(CancellationToken ct) =>
        Ok(await _store.GetAsync(GetUserId(), ct));

    [HttpPut]
    [ProducesResponseType(typeof(NotificationPreferences), StatusCodes.Status200OK)]
    public async Task<ActionResult<NotificationPreferences>> Put(
        [FromBody] NotificationPreferences prefs,
        CancellationToken ct)
    {
        await _store.SetAsync(GetUserId(), prefs, ct);
        return Ok(prefs);
    }

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim missing or malformed.");
        return id;
    }
}
