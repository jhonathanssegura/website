# Advanced Go Concurrency Patterns: Goroutines, Channels, and Beyond

Go's concurrency model, built around goroutines and channels, is one of its most powerful features. In this comprehensive guide, we'll explore advanced concurrency patterns that will help you build high-performance, scalable applications.

## Understanding Go's Concurrency Model

Go's concurrency is based on **CSP (Communicating Sequential Processes)** theory, where goroutines communicate through channels rather than sharing memory. This approach eliminates many common concurrency issues like race conditions and deadlocks.

### Goroutines: Lightweight Threads

Goroutines are lightweight threads managed by the Go runtime. They start with just 2KB of stack space and can scale to millions of concurrent goroutines.

```go
package main

import (
    "fmt"
    "time"
)

func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        fmt.Printf("worker %d processing job %d\n", id, j)
        time.Sleep(time.Second) // Simulate work
        results <- j * 2
    }
}

func main() {
    const numJobs = 5
    jobs := make(chan int, numJobs)
    results := make(chan int, numJobs)

    // Start 3 workers
    for w := 1; w <= 3; w++ {
        go worker(w, jobs, results)
    }

    // Send jobs
    for j := 1; j <= numJobs; j++ {
        jobs <- j
    }
    close(jobs)

    // Collect results
    for a := 1; a <= numJobs; a++ {
        <-results
    }
}
```

## Pattern 1: Worker Pool

The worker pool pattern is essential for controlling resource usage and managing concurrent tasks.

```go
package workerpool

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// Task represents a unit of work
type Task struct {
    ID       int
    Data     interface{}
    Result   interface{}
    Error    error
}

// WorkerPool manages a pool of workers
type WorkerPool struct {
    workers    int
    taskQueue  chan Task
    resultChan chan Task
    wg         sync.WaitGroup
    ctx        context.Context
    cancel     context.CancelFunc
}

// NewWorkerPool creates a new worker pool
func NewWorkerPool(workers int, queueSize int) *WorkerPool {
    ctx, cancel := context.WithCancel(context.Background())
    
    return &WorkerPool{
        workers:    workers,
        taskQueue:  make(chan Task, queueSize),
        resultChan: make(chan Task, queueSize),
        ctx:        ctx,
        cancel:     cancel,
    }
}

// Start starts the worker pool
func (wp *WorkerPool) Start() {
    for i := 0; i < wp.workers; i++ {
        wp.wg.Add(1)
        go wp.worker(i)
    }
}

// worker processes tasks from the queue
func (wp *WorkerPool) worker(id int) {
    defer wp.wg.Done()
    
    for {
        select {
        case task := <-wp.taskQueue:
            // Process the task
            result, err := wp.processTask(task)
            task.Result = result
            task.Error = err
            
            // Send result
            select {
            case wp.resultChan <- task:
            case <-wp.ctx.Done():
                return
            }
            
        case <-wp.ctx.Done():
            return
        }
    }
}

// processTask simulates task processing
func (wp *WorkerPool) processTask(task Task) (interface{}, error) {
    // Simulate work
    time.Sleep(100 * time.Millisecond)
    
    // Example processing logic
    switch data := task.Data.(type) {
    case string:
        return fmt.Sprintf("Processed: %s", data), nil
    case int:
        return data * 2, nil
    default:
        return nil, fmt.Errorf("unsupported data type")
    }
}

// SubmitTask submits a task to the pool
func (wp *WorkerPool) SubmitTask(task Task) error {
    select {
    case wp.taskQueue <- task:
        return nil
    case <-wp.ctx.Done():
        return fmt.Errorf("worker pool is closed")
    }
}

// GetResult gets a result from the pool
func (wp *WorkerPool) GetResult() (Task, error) {
    select {
    case result := <-wp.resultChan:
        return result, nil
    case <-wp.ctx.Done():
        return Task{}, fmt.Errorf("worker pool is closed")
    }
}

// Stop stops the worker pool
func (wp *WorkerPool) Stop() {
    wp.cancel()
    wp.wg.Wait()
    close(wp.taskQueue)
    close(wp.resultChan)
}

// Example usage
func ExampleWorkerPool() {
    pool := NewWorkerPool(4, 100)
    pool.Start()
    defer pool.Stop()

    // Submit tasks
    for i := 0; i < 10; i++ {
        task := Task{
            ID:   i,
            Data: fmt.Sprintf("task-%d", i),
        }
        pool.SubmitTask(task)
    }

    // Collect results
    for i := 0; i < 10; i++ {
        result, err := pool.GetResult()
        if err != nil {
            fmt.Printf("Error: %v\n", err)
            continue
        }
        fmt.Printf("Task %d: %v\n", result.ID, result.Result)
    }
}
```

## Pattern 2: Fan-Out/Fan-In

The fan-out/fan-in pattern distributes work across multiple goroutines and then collects the results.

```go
package fanout

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// FanOut distributes work across multiple workers
func FanOut(ctx context.Context, input <-chan int, workers int) []<-chan int {
    outputs := make([]<-chan int, workers)
    
    for i := 0; i < workers; i++ {
        outputs[i] = worker(ctx, input, i)
    }
    
    return outputs
}

// worker processes input and sends to output channel
func worker(ctx context.Context, input <-chan int, id int) <-chan int {
    output := make(chan int)
    
    go func() {
        defer close(output)
        
        for {
            select {
            case value, ok := <-input:
                if !ok {
                    return
                }
                
                // Simulate work
                time.Sleep(100 * time.Millisecond)
                result := value * value
                
                select {
                case output <- result:
                case <-ctx.Done():
                    return
                }
                
            case <-ctx.Done():
                return
            }
        }
    }()
    
    return output
}

// FanIn collects results from multiple channels
func FanIn(ctx context.Context, inputs ...<-chan int) <-chan int {
    output := make(chan int)
    var wg sync.WaitGroup
    
    // Start a goroutine for each input channel
    for _, input := range inputs {
        wg.Add(1)
        go func(input <-chan int) {
            defer wg.Done()
            
            for value := range input {
                select {
                case output <- value:
                case <-ctx.Done():
                    return
                }
            }
        }(input)
    }
    
    // Close output when all inputs are done
    go func() {
        wg.Wait()
        close(output)
    }()
    
    return output
}

// Example usage
func ExampleFanOutFanIn() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // Create input channel
    input := make(chan int)
    
    // Start fan-out
    outputs := FanOut(ctx, input, 3)
    
    // Start fan-in
    result := FanIn(ctx, outputs...)
    
    // Send work
    go func() {
        defer close(input)
        for i := 0; i < 10; i++ {
            select {
            case input <- i:
            case <-ctx.Done():
                return
            }
        }
    }()
    
    // Collect results
    for value := range result {
        fmt.Printf("Result: %d\n", value)
    }
}
```

## Pattern 3: Pipeline

Pipelines allow you to chain operations together, where each stage processes data and passes it to the next stage.

```go
package pipeline

import (
    "context"
    "fmt"
    "math"
    "time"
)

// Stage represents a pipeline stage
type Stage func(ctx context.Context, input <-chan int) <-chan int

// Pipeline chains multiple stages together
func Pipeline(ctx context.Context, input <-chan int, stages ...Stage) <-chan int {
    current := input
    
    for _, stage := range stages {
        current = stage(ctx, current)
    }
    
    return current
}

// MultiplyStage multiplies each value by a factor
func MultiplyStage(factor int) Stage {
    return func(ctx context.Context, input <-chan int) <-chan int {
        output := make(chan int)
        
        go func() {
            defer close(output)
            
            for value := range input {
                result := value * factor
                
                select {
                case output <- result:
                case <-ctx.Done():
                    return
                }
            }
        }()
        
        return output
    }
}

// AddStage adds a value to each input
func AddStage(addend int) Stage {
    return func(ctx context.Context, input <-chan int) <-chan int {
        output := make(chan int)
        
        go func() {
            defer close(output)
            
            for value := range input {
                result := value + addend
                
                select {
                case output <- result:
                case <-ctx.Done():
                    return
                }
            }
        }()
        
        return output
    }
}

// FilterStage filters values based on a predicate
func FilterStage(predicate func(int) bool) Stage {
    return func(ctx context.Context, input <-chan int) <-chan int {
        output := make(chan int)
        
        go func() {
            defer close(output)
            
            for value := range input {
                if predicate(value) {
                    select {
                    case output <- value:
                    case <-ctx.Done():
                        return
                    }
                }
            }
        }()
        
        return output
    }
}

// Example usage
func ExamplePipeline() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    // Create input
    input := make(chan int)
    
    // Create pipeline: multiply by 2, add 10, filter even numbers
    pipeline := Pipeline(ctx, input,
        MultiplyStage(2),
        AddStage(10),
        FilterStage(func(n int) bool { return n%2 == 0 }),
    )
    
    // Send input
    go func() {
        defer close(input)
        for i := 1; i <= 10; i++ {
            select {
            case input <- i:
            case <-ctx.Done():
                return
            }
        }
    }()
    
    // Collect results
    for result := range pipeline {
        fmt.Printf("Pipeline result: %d\n", result)
    }
}
```

## Pattern 4: Rate Limiting

Rate limiting is crucial for controlling resource usage and preventing system overload.

```go
package ratelimit

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// RateLimiter implements token bucket rate limiting
type RateLimiter struct {
    tokens    chan struct{}
    rate      time.Duration
    burst     int
    mu        sync.Mutex
    lastToken time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(rate time.Duration, burst int) *RateLimiter {
    rl := &RateLimiter{
        tokens: make(chan struct{}, burst),
        rate:   rate,
        burst:  burst,
    }
    
    // Fill the bucket
    for i := 0; i < burst; i++ {
        rl.tokens <- struct{}{}
    }
    
    // Start token refill
    go rl.refill()
    
    return rl
}

// refill refills the token bucket
func (rl *RateLimiter) refill() {
    ticker := time.NewTicker(rl.rate)
    defer ticker.Stop()
    
    for range ticker.C {
        select {
        case rl.tokens <- struct{}{}:
            // Token added
        default:
            // Bucket is full
        }
    }
}

// Allow checks if a request is allowed
func (rl *RateLimiter) Allow() bool {
    select {
    case <-rl.tokens:
        return true
    default:
        return false
    }
}

// Wait waits for a token to become available
func (rl *RateLimiter) Wait(ctx context.Context) error {
    select {
    case <-rl.tokens:
        return nil
    case <-ctx.Done():
        return ctx.Err()
    }
}

// Example usage
func ExampleRateLimiter() {
    // Create rate limiter: 10 requests per second, burst of 5
    limiter := NewRateLimiter(100*time.Millisecond, 5)
    
    // Simulate requests
    for i := 0; i < 20; i++ {
        if limiter.Allow() {
            fmt.Printf("Request %d: Allowed\n", i)
        } else {
            fmt.Printf("Request %d: Rate limited\n", i)
        }
        time.Sleep(50 * time.Millisecond)
    }
}
```

## Pattern 5: Context with Timeout and Cancellation

Proper context management is essential for controlling goroutine lifecycles.

```go
package context

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// ContextManager manages context-aware operations
type ContextManager struct {
    mu sync.RWMutex
}

// ProcessWithTimeout processes work with a timeout
func (cm *ContextManager) ProcessWithTimeout(ctx context.Context, work func() error, timeout time.Duration) error {
    ctx, cancel := context.WithTimeout(ctx, timeout)
    defer cancel()
    
    done := make(chan error, 1)
    
    go func() {
        done <- work()
    }()
    
    select {
    case err := <-done:
        return err
    case <-ctx.Done():
        return ctx.Err()
    }
}

// ProcessWithRetry processes work with retry logic
func (cm *ContextManager) ProcessWithRetry(ctx context.Context, work func() error, maxRetries int, backoff time.Duration) error {
    var lastErr error
    
    for attempt := 0; attempt <= maxRetries; attempt++ {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }
        
        if err := work(); err == nil {
            return nil
        } else {
            lastErr = err
            if attempt < maxRetries {
                time.Sleep(backoff * time.Duration(attempt+1))
            }
        }
    }
    
    return fmt.Errorf("failed after %d attempts: %v", maxRetries, lastErr)
}

// Example usage
func ExampleContextManager() {
    cm := &ContextManager{}
    ctx := context.Background()
    
    // Process with timeout
    err := cm.ProcessWithTimeout(ctx, func() error {
        time.Sleep(2 * time.Second)
        return nil
    }, 1*time.Second)
    
    if err != nil {
        fmt.Printf("Timeout error: %v\n", err)
    }
    
    // Process with retry
    err = cm.ProcessWithRetry(ctx, func() error {
        // Simulate flaky operation
        if time.Now().UnixNano()%3 == 0 {
            return fmt.Errorf("temporary error")
        }
        return nil
    }, 3, 100*time.Millisecond)
    
    if err != nil {
        fmt.Printf("Retry error: %v\n", err)
    }
}
```

## Pattern 6: Select with Default

The `select` statement with `default` allows for non-blocking operations.

```go
package select

import (
    "fmt"
    "time"
)

// NonBlockingChannel demonstrates non-blocking channel operations
func NonBlockingChannel() {
    ch := make(chan int, 1)
    
    // Non-blocking send
    select {
    case ch <- 1:
        fmt.Println("Sent value")
    default:
        fmt.Println("Channel is full")
    }
    
    // Non-blocking receive
    select {
    case value := <-ch:
        fmt.Printf("Received: %d\n", value)
    default:
        fmt.Println("No value available")
    }
}

// TimeoutPattern demonstrates timeout with select
func TimeoutPattern() {
    ch := make(chan string, 1)
    
    go func() {
        time.Sleep(2 * time.Second)
        ch <- "result"
    }()
    
    select {
    case result := <-ch:
        fmt.Printf("Got result: %s\n", result)
    case <-time.After(1 * time.Second):
        fmt.Println("Timeout")
    }
}
```

## Best Practices

### 1. Always Use Context

```go
func worker(ctx context.Context, input <-chan int) {
    for {
        select {
        case value := <-input:
            // Process value
        case <-ctx.Done():
            return
        }
    }
}
```

### 2. Avoid Goroutine Leaks

```go
func processWithTimeout(ctx context.Context, work func()) error {
    done := make(chan struct{})
    
    go func() {
        defer close(done)
        work()
    }()
    
    select {
    case <-done:
        return nil
    case <-ctx.Done():
        return ctx.Err()
    }
}
```

### 3. Use Buffered Channels Appropriately

```go
// Good: Buffered channel for known capacity
results := make(chan Result, 100)

// Good: Unbuffered channel for synchronization
done := make(chan struct{})
```

### 4. Handle Channel Closing

```go
func receiver(ch <-chan int) {
    for value := range ch {
        // Process value
    }
    // Channel is closed
}
```

## Performance Considerations

### 1. Goroutine Pooling

For CPU-intensive tasks, limit the number of goroutines to the number of CPU cores:

```go
import "runtime"

numWorkers := runtime.NumCPU()
```

### 2. Memory Management

Be careful with large objects in channels:

```go
// Bad: Large objects in channels
type LargeObject struct {
    Data []byte // Could be very large
}

// Good: Pass references or use object pools
type LargeObjectRef struct {
    ID   string
    Data *LargeObject
}
```

### 3. Channel Buffer Sizing

Size buffers based on expected throughput:

```go
// For high-throughput scenarios
bufferSize := 1000
ch := make(chan Task, bufferSize)
```

## Conclusion

Go's concurrency patterns provide powerful tools for building scalable applications. Key takeaways:

1. **Use goroutines for concurrent work**: They're lightweight and efficient
2. **Communicate through channels**: Avoid shared memory when possible
3. **Always use context**: For cancellation and timeouts
4. **Handle errors properly**: Don't let goroutines leak
5. **Choose the right pattern**: Worker pools, pipelines, fan-out/fan-in each have their use cases
6. **Monitor performance**: Use profiling tools to identify bottlenecks

Remember that concurrency adds complexity, so start simple and add patterns as needed. The Go runtime and standard library provide excellent tools for building concurrent applications, but they require careful design and testing. 