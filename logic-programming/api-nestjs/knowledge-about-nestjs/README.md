# Kiến thức về NestJS

## 1. Module

Module gom các thành phần của một tính năng (ví dụ "tài khoản") thành một khối. Khai báo bằng `@Module()` với 4 mục:

| Mục | Ý nghĩa |
|---|---|
| `imports` | Lấy module khác vào, để dùng những gì module đó chia sẻ |
| `controllers` | Các controller của module |
| `providers` | Các service của module |
| `exports` | Service cho module khác dùng. Chỉ export được service, không export được controller |

Ví dụ: `AuthService` cần dùng `UsersService`. Khi đó `UsersModule` phải `exports: [UsersService]` và `AuthModule` phải `imports: [UsersModule]`. Thiếu một trong hai thì ứng dụng báo lỗi khi khởi động.

```ts
@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

## 2. Controller

Controller nhận request HTTP: khai báo đường dẫn, lấy dữ liệu từ request, gọi service rồi trả kết quả. Controller không chứa nghiệp vụ.

```ts
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') // POST /auth/register
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
}
```

## 3. Service

Service chứa nghiệp vụ: kiểm tra, tính toán, đọc ghi DB. Service được đánh dấu `@Injectable()` và khai báo trong `providers`, để Nest đưa (inject) vào controller hoặc service khác.

**Dependency Injection:** class chỉ khai báo trong constructor những gì nó cần, Nest tự tạo và truyền vào, không phải tự `new`. Nhờ vậy khi test có thể dễ dàng thay bằng bản giả.

## 4. NestJS dùng TypeScript thế nào

TypeScript là JavaScript có thêm kiểu dữ liệu. Code được biên dịch ra JavaScript rồi chạy trên Node.js ở phía server. Vì có kiểu, các lỗi như sai kiểu hay sai tên bị phát hiện ngay khi viết code, và IDE gợi ý tốt hơn.

NestJS dựa vào TypeScript ở 3 chỗ:

- **Decorator:** các dòng `@...` gắn lên class, hàm hoặc tham số để báo cho Nest biết đó là gì, ví dụ `@Module`, `@Controller`, `@Get`, `@Injectable`, `@Body`.
- **Inject theo kiểu:** viết `constructor(private users: UsersService)` thì Nest đọc kiểu `UsersService` để biết phải truyền gì vào.
- **DTO:** class mô tả dữ liệu đi qua API, tách khỏi model DB.
  - Dữ liệu gửi lên: gắn luật kiểm tra như `@IsEmail()`, `@Length(3, 20)`. `ValidationPipe` tự kiểm tra và trả lỗi 400 nếu dữ liệu sai.
  - Dữ liệu trả về: chỉ trả những gì client cần, ví dụ không trả mật khẩu.
