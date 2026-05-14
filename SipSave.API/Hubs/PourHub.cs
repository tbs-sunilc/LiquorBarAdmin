using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SipSave.Domain.Interfaces;

namespace SipSave.API.Hubs;

/// <summary>
/// Real-time pour-request hub. Two group namespaces:
///   * <c>bar_{barId}</c>   — bartender tablets subscribed to a bar's live queue.
///   * <c>user_{userId}</c> — the end-user's devices, for instant balance updates.
///
/// Connection-lifecycle rules:
///   * On connect we auto-join the caller's <c>user_{userId}</c> group. End users
///     get SC-23→SC-24 auto-transitions without any client-side ceremony.
///   * Bartender tablets call <see cref="JoinBarGroup"/> after shift login; we
///     validate the caller is a staff member of that bar before subscribing.
///   * Connection auth is enforced by <c>[Authorize]</c>. OnConnect throws if the
///     caller's sub claim is missing — preventing anonymous group creation.
/// </summary>
[Authorize]
public class PourHub : Hub
{
    private readonly IStaffAccountRepository _staff;
    private readonly ILogger<PourHub> _logger;

    public PourHub(IStaffAccountRepository staff, ILogger<PourHub> logger)
    {
        _staff = staff;
        _logger = logger;
    }

    public static string BarGroupName(int barId)   => $"bar_{barId}";
    public static string UserGroupName(int userId) => $"user_{userId}";

    public override async Task OnConnectedAsync()
    {
        var sub = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? Context.User?.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var callerId))
        {
            // Shouldn't happen under [Authorize] + JwtBearer defaults; abort defensively.
            _logger.LogWarning("PourHub connect denied: missing 'sub' claim. ConnectionId={Conn}", Context.ConnectionId);
            Context.Abort();
            return;
        }

        // Every authenticated caller auto-joins their own user group. End users
        // get PourConfirmed / PourCancelled events on their own devices without
        // any client-side JoinXxx call.
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroupName(callerId));
        await base.OnConnectedAsync();
    }

    // ── Bartender-side membership ─────────────────────────────────────────

    /// <summary>
    /// Called by the bartender tablet after shift login. Verifies the caller is
    /// a live staff member at <paramref name="barId"/> before adding them to the
    /// bar broadcast group.
    /// </summary>
    public async Task JoinBarGroup(int barId)
    {
        var sub = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? Context.User?.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var staffId))
            throw new HubException("Unauthorized");

        // Staff table is separate from Users. The staff-login flow (Phase 8) mints a
        // token whose sub claim equals StaffAccounts.Id. We verify the row is active
        // and matches the bar.
        var staff = await _staff.GetByIdAsync(staffId);
        if (staff is null || !staff.IsActive || staff.BarId != barId)
        {
            _logger.LogWarning("JoinBarGroup denied. StaffId={StaffId} BarId={BarId}", staffId, barId);
            throw new HubException("You are not authorised to join this bar's pour queue.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, BarGroupName(barId));
        _logger.LogInformation("Staff {StaffId} joined {Group}", staffId, BarGroupName(barId));
    }

    public Task LeaveBarGroup(int barId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, BarGroupName(barId));
}
