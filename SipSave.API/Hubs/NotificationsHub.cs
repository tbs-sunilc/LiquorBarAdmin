using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SipSave.API.Hubs;

[Authorize]
public class NotificationsHub : Hub;
