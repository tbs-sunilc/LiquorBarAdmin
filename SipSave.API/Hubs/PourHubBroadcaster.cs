using Microsoft.AspNetCore.SignalR;
using SipSave.Application.Interfaces;

namespace SipSave.API.Hubs;

/// <summary>
/// Adapter from <see cref="IPourHubBroadcaster"/> (Application contract) to
/// SignalR's <see cref="IHubContext{PourHub}"/>. Event names here are the same
/// strings the clients subscribe to — they are a wire contract and must not
/// change without a coordinated client bump.
/// </summary>
public sealed class PourHubBroadcaster : IPourHubBroadcaster
{
    public const string EventNewPourRequest = "NewPourRequest";
    public const string EventPourConfirmed  = "PourConfirmed";
    public const string EventPourCancelled  = "PourCancelled";

    private readonly IHubContext<PourHub> _hub;
    public PourHubBroadcaster(IHubContext<PourHub> hub) => _hub = hub;

    public Task NewPourRequestToBarAsync(int barId, NewPourRequestEvent evt, CancellationToken ct = default) =>
        _hub.Clients.Group(PourHub.BarGroupName(barId))
            .SendAsync(EventNewPourRequest, evt, ct);

    public Task PourConfirmedToUserAsync(int userId, PourConfirmedEvent evt, CancellationToken ct = default) =>
        _hub.Clients.Group(PourHub.UserGroupName(userId))
            .SendAsync(EventPourConfirmed, evt, ct);

    public Task PourCancelledToUserAsync(int userId, PourCancelledEvent evt, CancellationToken ct = default) =>
        _hub.Clients.Group(PourHub.UserGroupName(userId))
            .SendAsync(EventPourCancelled, evt, ct);
}
