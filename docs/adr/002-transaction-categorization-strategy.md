# ADR 002: Transaction Categorization Strategy

## Status

Proposed

## Context

We need to automatically categorize financial transactions into predefined categories. The system should:
- Be accurate and consistent
- Learn from manual corrections
- Handle edge cases gracefully
- Be cost-effective (minimize API calls)
- Provide confidence scores for categorizations

## Decision

We will implement a categorization system using OpenAI's GPT-4 with the following components:

1. **Categorization Process**
   - Use GPT-4 for initial categorization
   - Batch process transactions to optimize API usage
   - Include transaction history for context
   - Generate confidence scores
   - Allow manual overrides

2. **Prompt Design**
   ```javascript
   {
     role: 'system',
     content: 'You are a financial transaction categorizer. Categorize the transaction into one of these categories: [CATEGORIES]. Consider the transaction description, amount, and any patterns from similar transactions.'
   }
   ```

3. **Batch Processing**
   - Process transactions in batches of 10
   - Include last 5 similar transactions for context
   - Cache results to minimize API calls
   - Implement rate limiting

4. **Learning Mechanism**
   - Store manual overrides
   - Use override history to improve future categorizations
   - Track categorization accuracy
   - Periodically retrain on manual corrections

## Consequences

### Positive
- High accuracy through GPT-4
- Cost-effective through batching
- Improves over time
- Handles edge cases well

### Negative
- API costs
- Rate limiting considerations
- Need to maintain prompt quality
- Potential for inconsistent categorizations

## Implementation Notes

1. Store categorization history
2. Implement caching system
3. Add monitoring for API usage
4. Create feedback loop for improvements
5. Set up error handling for API failures 