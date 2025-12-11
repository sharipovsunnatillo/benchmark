# WebFlux Reactive Application

This is a Spring Boot application demonstrating reactive programming using Spring WebFlux and R2DBC.

## Architecture

- **Framework**: Spring Boot 4.0.0
- **Web Layer**: Spring WebFlux (Reactive)
- **Data Access**: Spring Data R2DBC
- **Database**: PostgreSQL with R2DBC driver
- **Mapping**: MapStruct
- **Migrations**: Liquibase

## Reactive Programming

Reactive programming is a paradigm focused on asynchronous data streams and the propagation of change. It enables building non-blocking, event-driven applications that scale efficiently.

### Key Benefits

1. **Non-Blocking I/O**: Better resource utilization through asynchronous operations
2. **Backpressure**: Built-in support for handling overwhelming data flows
3. **Event-Driven**: React to events as they occur
4. **Composable**: Chain and transform data streams elegantly

### Reactive Stack

- **Reactor Core**: Publisher types (Mono and Flux)
- **R2DBC**: Reactive database driver
- **Netty**: Non-blocking I/O server

## Project Structure

```
src/
├── main/
│   ├── java/com/example/webflux/
│   │   ├── WebfluxApplication.java
│   │   ├── controller/
│   │   │   └── UserController.java
│   │   ├── service/
│   │   │   └── UserService.java
│   │   ├── repository/
│   │   │   └── UserRepository.java
│   │   ├── model/
│   │   │   └── User.java
│   │   ├── dto/
│   │   │   ├── CreateUserRequest.java
│   │   │   ├── UserResponse.java
│   │   │   └── PageResponse.java
│   │   └── mapper/
│   │       └── UserMapper.java
│   └── resources/
│       ├── application.yml
│       └── db/changelog/
│           └── db.changelog-master.xml
└── test/
```

## API Endpoints

### Create User
```http
POST /api/users
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2025-12-11T10:30:00",
  "updatedAt": "2025-12-11T10:30:00"
}
```

### Get Users (Paginated)
```http
GET /api/users?page=0&size=20
```

**Response (200 OK):**
```json
{
  "content": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2025-12-11T10:30:00",
      "updatedAt": "2025-12-11T10:30:00"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

## Building and Running

### Local Development

**Prerequisites:**
- Java 25
- Maven 3.9+
- PostgreSQL running on localhost:5433 (or configure with DB_PORT env var)

**Build:**
```bash
mvn clean package
```

**Run:**
```bash
java -jar target/webflux-0.0.1-SNAPSHOT.jar
```

### Docker

**Build Image:**
```bash
docker build -t webflux-app .
```

**Run Container:**
```bash
docker run -p 8084:8081 \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=benchmark \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  webflux-app
```

### Docker Compose

See the main README.md in the project root.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | benchmark |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `SERVER_PORT` | Application port | 8084 (host), 8081 (container) |

### JVM Options

The application uses the following JVM settings (configured in Dockerfile):
- Initial Heap: 512MB
- Max Heap: 1GB

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

## Reactive Programming Model

### Mono vs Flux

- **Mono**: Represents 0 or 1 element
  ```java
  Mono<UserResponse> createUser(CreateUserRequest request)
  ```

- **Flux**: Represents 0 to N elements
  ```java
  Flux<User> findAllPaged(int limit, int offset)
  ```

### Example Flow

```java
public Mono<UserResponse> createUser(CreateUserRequest request) {
    User user = userMapper.toEntity(request);
    user.setCreatedAt(LocalDateTime.now());
    user.setUpdatedAt(LocalDateTime.now());

    return userRepository.save(user)           // Mono<User>
            .map(userMapper::toResponse);      // Mono<UserResponse>
}
```

### Operators Used

- `map()`: Transform elements
- `flatMap()`: Async transformation
- `collectList()`: Collect Flux to List
- `zip()`: Combine publishers

## Testing

### Manual Testing

```bash
# Create a user
curl -X POST http://localhost:8084/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'

# Get users
curl http://localhost:8084/api/users?page=0&size=20
```

### Load Testing

See the main README.md for load testing instructions using K6, wrk2, or other tools.

## Performance Characteristics

### Expected Behavior

- **Thread Model**: Small, fixed thread pool (typically CPU cores * 2)
- **Memory**: Low memory overhead due to event loop
- **Concurrency**: Handles high concurrency through non-blocking I/O
- **CPU**: Efficient for I/O-bound operations, event-driven processing

### Event Loop

WebFlux uses Netty's event loop:
- Small number of threads handle all requests
- Non-blocking I/O operations
- Events processed asynchronously

### Monitoring

Monitor application performance:
```bash
# View logs
docker logs -f webflux-app

# Monitor resources
docker stats webflux-app
```

## Troubleshooting

### Blocking calls in reactive chain
- Avoid blocking operations in reactive pipelines
- Use `subscribeOn()` or `publishOn()` if blocking is unavoidable
- Consider using `Schedulers.boundedElastic()` for blocking operations

### Backpressure issues
- Monitor queue sizes
- Use backpressure strategies: `onBackpressureBuffer()`, `onBackpressureDrop()`

### R2DBC connection issues
- Verify R2DBC URL format: `r2dbc:postgresql://host:port/database`
- Check connection pool configuration
- Ensure Liquibase migrations completed (uses JDBC)

### Memory leaks
- Ensure all subscriptions are properly disposed
- Check for infinite streams without limits
- Monitor Netty buffer usage

## Best Practices

### Do's

1. **Keep chains non-blocking**: Use reactive operators
2. **Handle errors**: Use `onErrorResume()`, `onErrorReturn()`
3. **Test thoroughly**: Use `StepVerifier` for testing
4. **Use appropriate operators**: Choose between `map()`, `flatMap()`, etc.

### Don'ts

1. **Don't block**: Avoid `.block()` in production code
2. **Don't use Thread.sleep()**: Use `Mono.delay()` instead
3. **Don't forget to subscribe**: Reactive chains are lazy
4. **Don't mix blocking and non-blocking**: Stay fully reactive

## Further Reading

- [Spring WebFlux Documentation](https://docs.spring.io/spring-framework/reference/web/webflux.html)
- [Project Reactor](https://projectreactor.io/)
- [R2DBC Documentation](https://r2dbc.io/)
- [Reactive Programming Guide](https://www.reactivemanifesto.org/)
