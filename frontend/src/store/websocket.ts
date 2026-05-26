import { buildApiWebSocketUrl } from './api/base.api';

export const WSMessageType = {
	ChatMessageCreate: 0, 
	ChatMessageUpdate: 1,
	ChatMessageDelete: 2,
	TaskCreate: 3,
	TaskUpdate: 4,
	TaskDelete: 5,
	TaskMove: 6,
	TaskAssign: 7,
	TaskUnassign: 8,
	TaskSkillAdded: 9,
	TaskSkillRemoved: 10,
	ProjectMemberAdd: 11,
	ProjectMemberRemove: 12,
} as const;

type WSMessageType = typeof WSMessageType[keyof typeof WSMessageType];

type WSMessage<T> = {
	type: WSMessageType;
	payload: T;
}

type Listener = (msg: WSMessage<unknown>) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Listener | null = null;

  connect(projectID: string) {
    if (this.socket) return; // prevent duplicate connections

    this.socket = new WebSocket(buildApiWebSocketUrl(`/ws/connect/${projectID}`));

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as WSMessage<unknown>;
	  this.listeners?.(data);
    };

    this.socket.onclose = () => {
      this.socket = null;
    };
  }

  disconnect() {
	if(this.socket) {
		this.socket.close();
		this.socket = null;
	}
  }

  onMessage(listener: Listener) {
	this.listeners = listener;
  }
}

export const wsService = new WebSocketService();
