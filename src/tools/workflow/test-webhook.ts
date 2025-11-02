/**
 * Test Webhook Tool
 * 
 * This tool allows programmatic testing of n8n webhook endpoints.
 */

import { BaseWorkflowToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition } from '../../types/index.js';
import axios, { AxiosRequestConfig } from 'axios';
import { getEnvConfig } from '../../config/environment.js';

interface TestWebhookInput {
  workflowName: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: Record<string, any>;
  headers?: Record<string, string>;
  auth?: {
    username?: string;
    password?: string;
  };
}

/**
 * Handler for the test_webhook tool
 */
export class TestWebhookHandler extends BaseWorkflowToolHandler {
  /**
   * Execute the tool
   * 
   * @param args Tool arguments
   * @returns Test result with status, response, and timing
   */
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async () => {
      const input = args as TestWebhookInput;
      
      // Validate required fields
      if (!input.workflowName) {
        throw new Error('workflowName is required');
      }

      const config = getEnvConfig();
      const method = (input.method || 'POST').toUpperCase();
      
      // Construct webhook URL
      // Remove /api/v1 from base URL if present, webhooks use base URL directly
      const baseUrl = config.n8nApiUrl.replace(/\/api\/v1$/, '');
      const webhookUrl = `${baseUrl}/webhook/${input.workflowName}`;

      // Prepare request config
      const requestConfig: AxiosRequestConfig = {
        method: method as any,
        url: webhookUrl,
        headers: {
          'Content-Type': 'application/json',
          ...input.headers,
        },
        validateStatus: () => true, // Don't throw on any status
      };

      // Add data for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method) && input.data) {
        requestConfig.data = input.data;
      }

      // Add basic auth if provided
      if (input.auth) {
        requestConfig.auth = {
          username: input.auth.username || '',
          password: input.auth.password || '',
        };
      }

      // Execute webhook request and measure timing
      const startTime = Date.now();
      try {
        const response = await axios(requestConfig);
        const duration = Date.now() - startTime;

        const result = {
          success: response.status >= 200 && response.status < 300,
          statusCode: response.status,
          statusText: response.statusText,
          responseTime: `${duration}ms`,
          data: response.data,
          headers: response.headers,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: errorMessage,
                responseTime: `${duration}ms`,
                url: webhookUrl,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }
}

/**
 * Get tool definition for test_webhook
 * 
 * @returns Tool definition
 */
export function getTestWebhookToolDefinition(): ToolDefinition {
  return {
    name: 'test_webhook',
    description:
      'Test an n8n webhook endpoint by sending a test request. ' +
      'Allows programmatic testing of webhook configurations with custom payloads, methods, and headers. ' +
      'Returns response status, data, and timing information.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowName: {
          type: 'string',
          description: 'Name of the workflow webhook to test (e.g., "enhance-specs" for /webhook/enhance-specs)',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP method to use (default: POST)',
        },
        data: {
          type: 'object',
          description: 'Request payload to send (for POST/PUT/PATCH)',
        },
        headers: {
          type: 'object',
          description: 'Additional HTTP headers to include in the request',
        },
        auth: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Username for basic authentication',
            },
            password: {
              type: 'string',
              description: 'Password for basic authentication',
            },
          },
          description: 'Basic authentication credentials (if webhook requires auth)',
        },
      },
      required: ['workflowName'],
    },
  };
}
