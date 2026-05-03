import { WSMessageType } from './middleware/wsMessageTypes'

export { WSMessageType }

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

    this.socket = new WebSocket(`http://localhost:8000/api/v1/ws/connect/${projectID}`);

    this.socket.onopen = () => {
		console.log("engine starting up");
    };

    this.socket.onmessage = (event) => {
	  console.log(`received msg: ${event.data}`);
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
