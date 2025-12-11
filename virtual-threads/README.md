# Virtual Threads Application

This is a Spring Boot application demonstrating the use of Virtual Threads (Project Loom) for handling concurrent requests.

## Architecture

- **Framework**: Spring Boot 4.0.0
- **Web Layer**: Spring MVC with Virtual Threads enabled
- **Data Access**: Spring Data JDBC
- **Database**: PostgreSQL
- **Mapping**: MapStruct
- **Migrations**: Liquibase

## Virtual Threads

Virtual threads are lightweight threads introduced in Java 21 (Project Loom) that allow millions of concurrent tasks with minimal overhead. They enable writing simple, blocking-style code while maintaining high scalability.

### Key Benefits

1. **Simplified Code**: Write blocking code that's easier to understand and debug
2. **Better Resource Utilization**: Handle millions of concurrent requests with low memory overhead
3. **Improved Throughput**: Better CPU utilization for I/O-bound operations
4. **Backward Compatible**: Works with existing blocking libraries and frameworks

### Configuration

Virtual threads are enabled in `application.yml`:

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

## Project Structure

```
src/
├── main/
│   ├── java/com/example/virtualthreads/
│   │   ├── VirtualThreadsApplication.java
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
java -jar target/virtual-threads-0.0.1-SNAPSHOT.jar
```

### Docker

**Build Image:**
```bash
docker build -t virtual-threads-app .
```

**Run Container:**
```bash
docker run -p 8083:8080 \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=benchmark \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  virtual-threads-app
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
| `SERVER_PORT` | Application port | 8083 (host), 8080 (container) |

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

## Testing

### Manual Testing

```bash
# Create a user
curl -X POST http://localhost:8083/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'

# Get users
curl http://localhost:8083/api/users?page=0&size=20
```

### Load Testing

See the main README.md for load testing instructions using K6, wrk2, or other tools.

## Performance Characteristics

### Expected Behavior

- **Thread Model**: One virtual thread per request
- **Memory**: Low memory overhead per virtual thread (~1KB)
- **Concurrency**: Can handle hundreds of thousands of concurrent requests
- **CPU**: Efficient CPU utilization for I/O-bound operations

### Monitoring

Monitor application performance:
```bash
# View logs
docker logs -f virtual-threads-app

# Monitor resources
docker stats virtual-threads-app
```

## Troubleshooting

### Virtual Threads not enabled
- Ensure Java 25+ is being used
- Verify `spring.threads.virtual.enabled=true` in application.yml

### High memory usage
- Check JVM heap settings
- Monitor thread count and connection pool sizes

### Database connection issues
- Verify PostgreSQL is accessible
- Check connection pool configuration
- Ensure Liquibase migrations completed successfully

## Further Reading

- [Java Virtual Threads (JEP 444)](https://openjdk.org/jeps/444)
- [Spring Boot Virtual Threads Support](https://spring.io/blog/2023/09/09/virtual-threads-with-spring-boot-3-2)
- [Project Loom](https://wiki.openjdk.org/display/loom)
