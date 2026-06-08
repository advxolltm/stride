FROM golang:1.26.4-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

RUN go install github.com/air-verse/air@latest

RUN mkdir /swaggo && \
	cd /swaggo && \
	wget https://github.com/swaggo/swag/archive/refs/tags/v2.0.0-rc5.tar.gz && \
	tar xvf v2.0.0-rc5.tar.gz && \
	cd swag-2.0.0-rc5 && \
	go build -o ./bin/swag ./cmd/swag

ENV PATH=/swaggo/swag-2.0.0-rc5/bin:$PATH

RUN swag -h

COPY . .

EXPOSE 8000

CMD ["air", "-c", ".air.toml"]
