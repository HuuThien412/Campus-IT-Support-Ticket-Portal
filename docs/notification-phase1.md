# Phase 1 - Email Notifications

Phase 1 adds automatic email notifications without slowing down the main ticket API.

## Target Flow

```text
TicketService Lambda
  -> DynamoDB CampusSupportTickets
  -> DynamoDB Streams
  -> CampusSupportNotificationService Lambda
  -> Amazon SES
  -> Email notification
```

## Notification Rules

- `INSERT`: send ticket confirmation email to the requester.
- `INSERT` with `priority` equal to `High` or `Critical`: send alert email to the IT team.
- `MODIFY` when `status` or `resolutionNote` changes: send update email to the requester.

## 1. Verify SES Email Identities

Go to:

```text
Amazon SES -> Verified identities -> Create identity
```

Verify at least:

```text
FROM_EMAIL: campus support sender email
IT_TEAM_EMAIL: IT/admin receiver email
```

If SES is still in sandbox mode, every recipient email must also be verified before SES can send to it.

## 2. Create Notification Lambda

Create a new Lambda function:

```text
Function name: CampusSupportNotificationService
Runtime: Node.js 22.x
Region: ap-southeast-1
```

Paste code from:

```text
aws/lambda/CampusSupportNotificationService/index.mjs
```

Set environment variables:

```text
FROM_EMAIL=<verified sender email>
IT_TEAM_EMAIL=<verified IT team email>
APP_BASE_URL=https://main.d37atxjbyyp60m.amplifyapp.com
NOTIFICATION_ENABLED=true
```

## 3. Add IAM Permission For SES

Open the Lambda execution role and add an inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

## 4. Enable DynamoDB Stream

Go to:

```text
DynamoDB -> Tables -> CampusSupportTickets -> Exports and streams -> DynamoDB stream details
```

Enable stream with:

```text
View type: New and old images
```

This is required so the notification Lambda can compare old and new ticket status.

## 5. Attach Stream Trigger To Lambda

Go to:

```text
Lambda -> CampusSupportNotificationService -> Add trigger
```

Choose:

```text
Source: DynamoDB
Table: CampusSupportTickets
Batch size: 10
Starting position: Latest
```

Enable the trigger.

## 6. Test

Test these cases:

1. Create a new Low/Medium ticket.
   - Requester receives confirmation email.
2. Create a High/Critical ticket.
   - Requester receives confirmation email.
   - IT team receives priority alert email.
3. Admin updates ticket status.
   - Requester receives status update email.

## Notes

- SES sandbox mode only sends to verified recipient emails.
- Email sending is asynchronous through DynamoDB Streams, so ticket creation remains fast.
- CloudWatch Logs for `CampusSupportNotificationService` should be checked when emails do not arrive.
