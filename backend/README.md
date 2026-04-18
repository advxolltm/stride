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


## Generate OpenAPI / Swagger documentation
We use [swaggo/swag](https://github.com/swaggo/swag) for API documenation. When run, the tool parses special comments in the [Delcarative Comments Format](https://github.com/swaggo/swag#declarative-comments-format).

### Install
Please note that since we are using `echo/v5` it is unfortunately not possible to use `swaggo/swag` (v1), but rather we need to use `swaggo/swag/v2` which is currently not fully released. This also means that you **cannot** install it via `go install ...`. However, getting the binary is very simple: 

- for linux and macos: just download the [latest release](https://github.com/swaggo/swag/releases/tag/v2.0.0-rc5) and unpack the `.tar.gz`
- for windows: just download the [source code](https://github.com/swaggo/swag/releases/tag/v2.0.0-rc5) and then build the project using `go build ./cmd/swag.go` (or use the provided `Makefile`)

### Usage
Note: I will refer to the binary with `swag`, however, when running the following commands you obviously need to provide a correct path to the binary.

#### Help
Firstly, use `swag help`, `swag init help` and `swag fmt help` to get an overview of the CLI.

#### Generate documentation
The `swag init` command requires a path to the file containing the general api definition (in our case: `cmd/server.go`) and a list of directories to search through for the route comments (in our case: `routes`).

To generate the documentation, run the following command:

```
swag init -g server.go -d ./cmd,./routes
```

Note that you should not use `-g cmd/server.go` since `swag` automatically prepends the paths specified in `-d ...`

#### Format documentation
For consistency, please always format the documentation before committing, this can be done similarly to the `init` command:

```
swag fmt -g server.go -d ./cmd,./routes
```
