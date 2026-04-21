# STRIDE backend

## Local Build

You can just run the server using the following command:

```bash
go run cmd/server.go
```

If you want to build an executable, run the following command which puts the binary in the `./bin/` directory:

```bash
go build -o bin/server cmd/server.go
```

## Testing

For local testing you need to open terminal in backend's root and run this command

```bash
go test -count=1 -p 1 ./...
```

You need to make sure test aren't failing before creating PR
