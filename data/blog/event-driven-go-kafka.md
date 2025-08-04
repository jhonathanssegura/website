# Event-Driven Architecture with Go and Apache Kafka: From Zero to Production

Event-driven architecture (EDA) has become the cornerstone of modern distributed systems, enabling scalable, loosely-coupled, and resilient applications. In this comprehensive guide, we'll explore how to build production-ready event-driven systems using Go and Apache Kafka.

## Why Event-Driven Architecture?

Event-driven architecture offers several advantages for modern applications:

- **Loose Coupling**: Services communicate through events without direct dependencies
- **Scalability**: Horizontal scaling becomes easier with event streaming
- **Resilience**: Systems can handle failures gracefully with event replay
- **Real-time Processing**: Immediate reaction to business events
- **Audit Trail**: Complete history of all system events

## Understanding Event-Driven Patterns

### Event Sourcing

Event sourcing stores all changes to application state as a sequence of events. Instead of storing the current state, we store the events that led to that state.

```go
// Event represents a domain event
type Event struct {
    ID          string    `json:"id"`
    Type        string    `json:"type"`
    AggregateID string    `json:"aggregate_id"`
    Version     int       `json:"version"`
    Data        []byte    `json:"data"`
    Timestamp   time.Time `json:"timestamp"`
    Metadata    Metadata  `json:"metadata"`
}

// EventStore interface for storing events
type EventStore interface {
    AppendEvents(aggregateID string, events []Event) error
    GetEvents(aggregateID string) ([]Event, error)
    GetEventsByType(eventType string) ([]Event, error)
}
```

### CQRS (Command Query Responsibility Segregation)

CQRS separates read and write operations, allowing us to optimize each independently.

```go
// Command represents a write operation
type Command interface {
    GetAggregateID() string
    GetCommandType() string
}

// Query represents a read operation
type Query interface {
    GetQueryType() string
    GetParameters() map[string]interface{}
}

// CommandHandler processes commands
type CommandHandler interface {
    Handle(command Command) error
}

// QueryHandler processes queries
type QueryHandler interface {
    Handle(query Query) (interface{}, error)
}
```

## Setting Up Apache Kafka with Go

### Installing and Configuring Kafka

First, let's set up Kafka using Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
```

### Go Kafka Client Setup

```go
package kafka

import (
    "github.com/Shopify/sarama"
    "github.com/Shopify/sarama/mocks"
)

// KafkaConfig holds Kafka configuration
type KafkaConfig struct {
    Brokers []string
    Version sarama.KafkaVersion
    Config  *sarama.Config
}

// NewKafkaConfig creates a new Kafka configuration
func NewKafkaConfig(brokers []string) *KafkaConfig {
    config := sarama.NewConfig()
    config.Version = sarama.V2_8_0_0
    config.Producer.Return.Successes = true
    config.Producer.RequiredAcks = sarama.WaitForAll
    config.Producer.Retry.Max = 5
    config.Consumer.Group.Rebalance.Strategy = sarama.BalanceStrategyRoundRobin
    config.Consumer.Offsets.Initial = sarama.OffsetOldest

    return &KafkaConfig{
        Brokers: brokers,
        Version: sarama.V2_8_0_0,
        Config:  config,
    }
}
```

## Event Producer Implementation

```go
package producer

import (
    "encoding/json"
    "log"
    "time"

    "github.com/Shopify/sarama"
)

// EventProducer handles event publishing
type EventProducer struct {
    producer sarama.SyncProducer
}

// NewEventProducer creates a new event producer
func NewEventProducer(brokers []string) (*EventProducer, error) {
    config := sarama.NewConfig()
    config.Producer.Return.Successes = true
    config.Producer.RequiredAcks = sarama.WaitForAll
    config.Producer.Retry.Max = 5

    producer, err := sarama.NewSyncProducer(brokers, config)
    if err != nil {
        return nil, err
    }

    return &EventProducer{producer: producer}, nil
}

// PublishEvent publishes an event to Kafka
func (ep *EventProducer) PublishEvent(topic string, event Event) error {
    event.Timestamp = time.Now()
    
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }

    message := &sarama.ProducerMessage{
        Topic: topic,
        Key:   sarama.StringEncoder(event.AggregateID),
        Value: sarama.ByteEncoder(data),
        Headers: []sarama.RecordHeader{
            {
                Key:   []byte("event_type"),
                Value: []byte(event.Type),
            },
            {
                Key:   []byte("aggregate_id"),
                Value: []byte(event.AggregateID),
            },
        },
    }

    partition, offset, err := ep.producer.SendMessage(message)
    if err != nil {
        return err
    }

    log.Printf("Event published to topic %s, partition %d, offset %d", 
        topic, partition, offset)
    
    return nil
}

// Close closes the producer
func (ep *EventProducer) Close() error {
    return ep.producer.Close()
}
```

## Event Consumer Implementation

```go
package consumer

import (
    "context"
    "encoding/json"
    "log"
    "sync"

    "github.com/Shopify/sarama"
)

// EventConsumer handles event consumption
type EventConsumer struct {
    consumer sarama.ConsumerGroup
    handlers map[string]EventHandler
    mu       sync.RWMutex
}

// EventHandler processes events
type EventHandler func(event Event) error

// NewEventConsumer creates a new event consumer
func NewEventConsumer(brokers []string, groupID string) (*EventConsumer, error) {
    config := sarama.NewConfig()
    config.Consumer.Group.Rebalance.Strategy = sarama.BalanceStrategyRoundRobin
    config.Consumer.Offsets.Initial = sarama.OffsetOldest

    consumer, err := sarama.NewConsumerGroup(brokers, groupID, config)
    if err != nil {
        return nil, err
    }

    return &EventConsumer{
        consumer: consumer,
        handlers: make(map[string]EventHandler),
    }, nil
}

// RegisterHandler registers an event handler
func (ec *EventConsumer) RegisterHandler(eventType string, handler EventHandler) {
    ec.mu.Lock()
    defer ec.mu.Unlock()
    ec.handlers[eventType] = handler
}

// ConsumeMessages implements sarama.ConsumerGroupHandler
func (ec *EventConsumer) ConsumeMessages(ctx context.Context, topics []string) error {
    for {
        err := ec.consumer.Consume(ctx, topics, ec)
        if err != nil {
            log.Printf("Error from consumer: %v", err)
        }
        if ctx.Err() != nil {
            return ctx.Err()
        }
    }
}

// ConsumeClaim implements sarama.ConsumerGroupHandler
func (ec *EventConsumer) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
    for message := range claim.Messages() {
        var event Event
        if err := json.Unmarshal(message.Value, &event); err != nil {
            log.Printf("Error unmarshaling event: %v", err)
            continue
        }

        ec.mu.RLock()
        handler, exists := ec.handlers[event.Type]
        ec.mu.RUnlock()

        if !exists {
            log.Printf("No handler found for event type: %s", event.Type)
            continue
        }

        if err := handler(event); err != nil {
            log.Printf("Error handling event: %v", err)
            // In production, you might want to implement dead letter queues
            continue
        }

        session.MarkMessage(message, "")
    }
    return nil
}

// Setup implements sarama.ConsumerGroupHandler
func (ec *EventConsumer) Setup(sarama.ConsumerGroupSession) error {
    return nil
}

// Cleanup implements sarama.ConsumerGroupHandler
func (ec *EventConsumer) Cleanup(sarama.ConsumerGroupSession) error {
    return nil
}

// Close closes the consumer
func (ec *EventConsumer) Close() error {
    return ec.consumer.Close()
}
```

## Implementing Saga Pattern

The Saga pattern is crucial for maintaining data consistency across microservices.

```go
package saga

import (
    "context"
    "encoding/json"
    "time"
)

// SagaStep represents a step in a saga
type SagaStep struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Compensate  bool                   `json:"compensate"`
    Data        map[string]interface{} `json:"data"`
    Status      SagaStepStatus         `json:"status"`
    Error       string                 `json:"error,omitempty"`
    CreatedAt   time.Time              `json:"created_at"`
    CompletedAt *time.Time             `json:"completed_at,omitempty"`
}

// Saga represents a distributed transaction
type Saga struct {
    ID        string      `json:"id"`
    Type      string      `json:"type"`
    Steps     []SagaStep  `json:"steps"`
    Status    SagaStatus  `json:"status"`
    CreatedAt time.Time   `json:"created_at"`
    UpdatedAt time.Time   `json:"updated_at"`
}

// SagaManager manages saga execution
type SagaManager struct {
    producer EventProducer
    store    SagaStore
}

// ExecuteSaga executes a saga
func (sm *SagaManager) ExecuteSaga(ctx context.Context, sagaType string, data map[string]interface{}) error {
    saga := &Saga{
        ID:        generateID(),
        Type:      sagaType,
        Status:    SagaStatusStarted,
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

    // Define saga steps based on type
    steps := sm.defineSagaSteps(sagaType, data)
    saga.Steps = steps

    // Save saga to store
    if err := sm.store.SaveSaga(saga); err != nil {
        return err
    }

    // Publish saga started event
    event := Event{
        ID:          generateID(),
        Type:        "saga.started",
        AggregateID: saga.ID,
        Data:        saga,
    }

    return sm.producer.PublishEvent("saga-events", event)
}

// defineSagaSteps defines the steps for a saga type
func (sm *SagaManager) defineSagaSteps(sagaType string, data map[string]interface{}) []SagaStep {
    switch sagaType {
    case "order-processing":
        return []SagaStep{
            {
                ID:         generateID(),
                Name:       "validate-inventory",
                Compensate: true,
                Data:       data,
                Status:     SagaStepStatusPending,
                CreatedAt:  time.Now(),
            },
            {
                ID:         generateID(),
                Name:       "process-payment",
                Compensate: true,
                Data:       data,
                Status:     SagaStepStatusPending,
                CreatedAt:  time.Now(),
            },
            {
                ID:         generateID(),
                Name:       "update-inventory",
                Compensate: true,
                Data:       data,
                Status:     SagaStepStatusPending,
                CreatedAt:  time.Now(),
            },
        }
    default:
        return []SagaStep{}
    }
}
```

## Building a Complete Event-Driven Service

Let's build a complete order service using event-driven architecture:

```go
package orderservice

import (
    "context"
    "encoding/json"
    "log"
    "time"
)

// OrderService represents the order service
type OrderService struct {
    producer EventProducer
    consumer EventConsumer
    store    OrderStore
    sagaMgr  *SagaManager
}

// NewOrderService creates a new order service
func NewOrderService(brokers []string) (*OrderService, error) {
    producer, err := NewEventProducer(brokers)
    if err != nil {
        return nil, err
    }

    consumer, err := NewEventConsumer(brokers, "order-service")
    if err != nil {
        return nil, err
    }

    store := NewOrderStore()
    sagaMgr := NewSagaManager(producer, store)

    service := &OrderService{
        producer: producer,
        consumer: consumer,
        store:    store,
        sagaMgr:  sagaMgr,
    }

    // Register event handlers
    service.registerHandlers()

    return service, nil
}

// CreateOrder creates a new order
func (os *OrderService) CreateOrder(ctx context.Context, order Order) error {
    // Save order to local store
    if err := os.store.SaveOrder(&order); err != nil {
        return err
    }

    // Publish order created event
    event := Event{
        ID:          generateID(),
        Type:        "order.created",
        AggregateID: order.ID,
        Data:        order,
    }

    if err := os.producer.PublishEvent("order-events", event); err != nil {
        return err
    }

    // Start order processing saga
    sagaData := map[string]interface{}{
        "order_id": order.ID,
        "user_id":  order.UserID,
        "amount":   order.TotalAmount,
    }

    return os.sagaMgr.ExecuteSaga(ctx, "order-processing", sagaData)
}

// registerHandlers registers event handlers
func (os *OrderService) registerHandlers() {
    os.consumer.RegisterHandler("inventory.reserved", os.handleInventoryReserved)
    os.consumer.RegisterHandler("payment.processed", os.handlePaymentProcessed)
    os.consumer.RegisterHandler("inventory.updated", os.handleInventoryUpdated)
    os.consumer.RegisterHandler("saga.completed", os.handleSagaCompleted)
    os.consumer.RegisterHandler("saga.failed", os.handleSagaFailed)
}

// handleInventoryReserved handles inventory reserved events
func (os *OrderService) handleInventoryReserved(event Event) error {
    var data map[string]interface{}
    if err := json.Unmarshal(event.Data, &data); err != nil {
        return err
    }

    orderID := data["order_id"].(string)
    order, err := os.store.GetOrder(orderID)
    if err != nil {
        return err
    }

    order.Status = OrderStatusInventoryReserved
    order.UpdatedAt = time.Now()

    return os.store.UpdateOrder(order)
}

// handlePaymentProcessed handles payment processed events
func (os *OrderService) handlePaymentProcessed(event Event) error {
    var data map[string]interface{}
    if err := json.Unmarshal(event.Data, &data); err != nil {
        return err
    }

    orderID := data["order_id"].(string)
    order, err := os.store.GetOrder(orderID)
    if err != nil {
        return err
    }

    order.Status = OrderStatusPaymentProcessed
    order.UpdatedAt = time.Now()

    return os.store.UpdateOrder(order)
}

// handleInventoryUpdated handles inventory updated events
func (os *OrderService) handleInventoryUpdated(event Event) error {
    var data map[string]interface{}
    if err := json.Unmarshal(event.Data, &data); err != nil {
        return err
    }

    orderID := data["order_id"].(string)
    order, err := os.store.GetOrder(orderID)
    if err != nil {
        return err
    }

    order.Status = OrderStatusCompleted
    order.UpdatedAt = time.Now()

    return os.store.UpdateOrder(order)
}

// handleSagaCompleted handles saga completed events
func (os *OrderService) handleSagaCompleted(event Event) error {
    log.Printf("Saga completed for order: %s", event.AggregateID)
    return nil
}

// handleSagaFailed handles saga failed events
func (os *OrderService) handleSagaFailed(event Event) error {
    var data map[string]interface{}
    if err := json.Unmarshal(event.Data, &data); err != nil {
        return err
    }

    orderID := data["order_id"].(string)
    order, err := os.store.GetOrder(orderID)
    if err != nil {
        return err
    }

    order.Status = OrderStatusFailed
    order.UpdatedAt = time.Now()

    return os.store.UpdateOrder(order)
}

// Start starts the order service
func (os *OrderService) Start(ctx context.Context) error {
    topics := []string{"order-events", "inventory-events", "payment-events", "saga-events"}
    return os.consumer.ConsumeMessages(ctx, topics)
}

// Stop stops the order service
func (os *OrderService) Stop() error {
    if err := os.consumer.Close(); err != nil {
        return err
    }
    return os.producer.Close()
}
```

## Monitoring and Observability

### Metrics Collection

```go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    EventsPublished = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "events_published_total",
            Help: "Total number of events published",
        },
        []string{"topic", "event_type"},
    )

    EventsConsumed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "events_consumed_total",
            Help: "Total number of events consumed",
        },
        []string{"topic", "event_type", "consumer_group"},
    )

    EventProcessingDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "event_processing_duration_seconds",
            Help:    "Time spent processing events",
            Buckets: prometheus.DefBuckets,
        },
        []string{"event_type", "consumer_group"},
    )

    SagaExecutionDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "saga_execution_duration_seconds",
            Help:    "Time spent executing sagas",
            Buckets: prometheus.DefBuckets,
        },
        []string{"saga_type"},
    )
)
```

### Distributed Tracing

```go
package tracing

import (
    "context"
    "github.com/opentracing/opentracing-go"
    "github.com/uber/jaeger-client-go"
    "github.com/uber/jaeger-client-go/config"
)

// InitTracer initializes distributed tracing
func InitTracer(serviceName string) (opentracing.Tracer, error) {
    cfg := &config.Configuration{
        ServiceName: serviceName,
        Sampler: &config.SamplerConfig{
            Type:  "const",
            Param: 1,
        },
        Reporter: &config.ReporterConfig{
            LogSpans: true,
        },
    }

    tracer, closer, err := cfg.NewTracer(config.Options{
        Logger: jaeger.StdLogger,
    })
    if err != nil {
        return nil, err
    }

    opentracing.SetGlobalTracer(tracer)
    return tracer, nil
}

// TraceEvent adds tracing to event processing
func TraceEvent(ctx context.Context, eventType string, fn func() error) error {
    span, ctx := opentracing.StartSpanFromContext(ctx, "process_event")
    defer span.Finish()

    span.SetTag("event_type", eventType)
    
    return fn()
}
```

## Testing Event-Driven Systems

### Unit Testing

```go
package testing

import (
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

// MockEventProducer mocks the event producer
type MockEventProducer struct {
    mock.Mock
}

func (m *MockEventProducer) PublishEvent(topic string, event Event) error {
    args := m.Called(topic, event)
    return args.Error(0)
}

func (m *MockEventProducer) Close() error {
    args := m.Called()
    return args.Error(0)
}

// TestOrderService_CreateOrder tests order creation
func TestOrderService_CreateOrder(t *testing.T) {
    mockProducer := new(MockEventProducer)
    mockStore := new(MockOrderStore)

    service := &OrderService{
        producer: mockProducer,
        store:    mockStore,
    }

    order := Order{
        ID:          "order-123",
        UserID:      "user-456",
        TotalAmount: 100.0,
        Status:      OrderStatusPending,
    }

    // Setup expectations
    mockStore.On("SaveOrder", &order).Return(nil)
    mockProducer.On("PublishEvent", "order-events", mock.AnythingOfType("Event")).Return(nil)

    // Execute
    err := service.CreateOrder(context.Background(), order)

    // Assert
    assert.NoError(t, err)
    mockStore.AssertExpectations(t)
    mockProducer.AssertExpectations(t)
}
```

### Integration Testing

```go
package integration

import (
    "context"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/Shopify/sarama"
)

// TestEventDrivenOrderFlow tests the complete order flow
func TestEventDrivenOrderFlow(t *testing.T) {
    // Setup Kafka test environment
    brokers := []string{"localhost:9092"}
    
    // Create test producer
    producer, err := NewEventProducer(brokers)
    assert.NoError(t, err)
    defer producer.Close()

    // Create test consumer
    consumer, err := NewEventConsumer(brokers, "test-consumer")
    assert.NoError(t, err)
    defer consumer.Close()

    // Create order service
    service, err := NewOrderService(brokers)
    assert.NoError(t, err)

    // Start service
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    go func() {
        err := service.Start(ctx)
        assert.NoError(t, err)
    }()

    // Wait for service to start
    time.Sleep(2 * time.Second)

    // Create order
    order := Order{
        ID:          "test-order-123",
        UserID:      "test-user-456",
        TotalAmount: 50.0,
        Status:      OrderStatusPending,
    }

    err = service.CreateOrder(ctx, order)
    assert.NoError(t, err)

    // Wait for order processing
    time.Sleep(5 * time.Second)

    // Verify order status
    finalOrder, err := service.store.GetOrder(order.ID)
    assert.NoError(t, err)
    assert.Equal(t, OrderStatusCompleted, finalOrder.Status)
}
```

## Production Considerations

### Error Handling and Dead Letter Queues

```go
package dql

import (
    "encoding/json"
    "log"
    "time"
)

// DeadLetterQueue handles failed events
type DeadLetterQueue struct {
    producer EventProducer
    store    DLQStore
}

// ProcessFailedEvent processes a failed event
func (dlq *DeadLetterQueue) ProcessFailedEvent(event Event, error string) error {
    dlqEvent := DLQEvent{
        OriginalEvent: event,
        Error:         error,
        FailedAt:      time.Now(),
        RetryCount:    0,
    }

    // Store in DLQ
    if err := dlq.store.SaveDLQEvent(&dlqEvent); err != nil {
        return err
    }

    // Publish to DLQ topic
    dlqEventData, err := json.Marshal(dlqEvent)
    if err != nil {
        return err
    }

    dlqEventMsg := Event{
        ID:          generateID(),
        Type:        "dlq.event.failed",
        AggregateID: event.AggregateID,
        Data:        dlqEventData,
    }

    return dlq.producer.PublishEvent("dead-letter-queue", dlqEventMsg)
}
```

### Event Schema Evolution

```go
package schema

import (
    "encoding/json"
    "fmt"
)

// EventSchema represents an event schema
type EventSchema struct {
    Version   int                    `json:"version"`
    EventType string                 `json:"event_type"`
    Schema    map[string]interface{} `json:"schema"`
}

// SchemaRegistry manages event schemas
type SchemaRegistry struct {
    schemas map[string]EventSchema
}

// ValidateEvent validates an event against its schema
func (sr *SchemaRegistry) ValidateEvent(event Event) error {
    schema, exists := sr.schemas[event.Type]
    if !exists {
        return fmt.Errorf("schema not found for event type: %s", event.Type)
    }

    // Validate event data against schema
    var eventData map[string]interface{}
    if err := json.Unmarshal(event.Data, &eventData); err != nil {
        return err
    }

    return sr.validateSchema(eventData, schema.Schema)
}

// validateSchema validates data against a schema
func (sr *SchemaRegistry) validateSchema(data map[string]interface{}, schema map[string]interface{}) error {
    // Implement schema validation logic
    // This is a simplified version - in production, you might use JSON Schema
    return nil
}
```

## Conclusion

Building event-driven systems with Go and Apache Kafka requires careful consideration of several aspects:

1. **Event Design**: Design events that are meaningful and contain all necessary data
2. **Schema Management**: Implement proper schema evolution strategies
3. **Error Handling**: Build robust error handling with dead letter queues
4. **Monitoring**: Implement comprehensive monitoring and observability
5. **Testing**: Create thorough test suites for event-driven systems
6. **Performance**: Optimize for high-throughput event processing

Event-driven architecture with Go and Kafka provides a powerful foundation for building scalable, resilient, and maintainable distributed systems. By following the patterns and practices outlined in this guide, you can create production-ready event-driven applications that can handle millions of events per second while maintaining data consistency and system reliability.

Remember that event-driven architecture is not a silver bullet - it adds complexity and requires careful design. However, when implemented correctly, it provides significant benefits in terms of scalability, maintainability, and system resilience. 