FROM golang:1.26.1-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "go mod download && go run cmd/server.go"]