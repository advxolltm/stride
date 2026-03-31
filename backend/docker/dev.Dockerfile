FROM golang:1.26.1-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

RUN go install github.com/air-verse/air@latest

COPY . .

EXPOSE 8000

CMD ["air", "-c", ".air.toml"]