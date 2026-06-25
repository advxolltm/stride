FROM golang:1.26.4-alpine AS builder

ENV CGO_ENABLED=0

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/stride-server ./cmd/server.go
RUN go build -trimpath -ldflags="-s -w" -o /out/stride-create-user ./cmd/create-user
RUN go build -trimpath -ldflags="-s -w" -o /out/stride-seed-demo ./cmd/seed-demo

FROM alpine:3.22 AS production

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /out/stride-server /app/stride-server
COPY --from=builder /out/stride-create-user /app/stride-create-user
COPY --from=builder /out/stride-seed-demo /app/stride-seed-demo

RUN mkdir -p /app/media

EXPOSE 8000

CMD ["/app/stride-server"]
