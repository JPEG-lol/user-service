import { Kafka, Producer, Partitioners } from 'kafkajs';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: [config.kafka.broker],
  retry: {
    initialRetryTime: 3000,
    retries: 30,
    maxRetryTime: 30000,
    factor: 2,
    multiplier: 2,
  }
});

let producer: Producer | null = null;
let isProducerConnected = false;
let producerLogger: Logger | Console = console;

export const initializeKafkaProducerLogger = (loggerInstance: Logger) => {
    producerLogger = loggerInstance;
};

export const getKafkaProducer = async (loggerInstance?: Logger, correlationId?: string): Promise<Producer> => {
  const currentLogger = loggerInstance || producerLogger;
  const opCorrelationId = correlationId || uuidv4();
  const clientId = config.kafka.clientId;

  if (producer && isProducerConnected) {
    return producer;
  }
  
  const newProducer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    allowAutoTopicCreation: config.nodeEnv !== 'production',
  });

  try {
    await newProducer.connect();
    currentLogger.info(`Kafka Producer [${clientId}] connected to ${config.kafka.broker}`, { correlationId: opCorrelationId, clientId, type: 'KafkaProducerLog.Connected' });
    producer = newProducer;
    isProducerConnected = true;

    producer.on('producer.disconnect', () => {
        currentLogger.warn(`Kafka Producer [${clientId}] disconnected unexpectedly.`, { correlationId: opCorrelationId, clientId, type: 'KafkaProducerEvent.Disconnect' });
        isProducerConnected = false;
        producer = null;
    });

    return producer;
  } catch (error: any) {
    currentLogger.error(`Kafka Producer [${clientId}] failed to connect.`, { correlationId: opCorrelationId, clientId, error: error.message, stack: error.stack, type: 'KafkaProducerLog.ConnectError' });
    isProducerConnected = false;
    producer = null;
    throw error;
  }
};

export const disconnectProducer = async (correlationId?: string): Promise<void> => {
  const opCorrelationId = correlationId || uuidv4();
  const clientId = config.kafka.clientId;
  if (producer) {
    try {
      await producer.disconnect();
      producerLogger.info(`Kafka Producer [${clientId}] disconnected successfully.`, { correlationId: opCorrelationId, clientId, type: 'KafkaProducerLog.Disconnected' });
    } catch (error: any) {
      producerLogger.error(`Error disconnecting Kafka Producer [${clientId}]`, { correlationId: opCorrelationId, clientId, error: error.message, stack: error.stack, type: 'KafkaProducerLog.DisconnectError' });
    } finally {
      producer = null;
      isProducerConnected = false;
    }
  }
};