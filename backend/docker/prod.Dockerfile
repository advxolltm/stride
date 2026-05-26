FROM golang:1.26.3-alpine AS builder

ENV CGO_ENABLED=0

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/stride-server ./cmd/server.go

FROM alpine:3.22 AS production

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /out/stride-server /app/stride-server

RUN mkdir -p /app/media

EXPOSE 8000

CMD ["/app/stride-server"]
