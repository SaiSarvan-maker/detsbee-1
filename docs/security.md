# Security & Privacy

## Consent

- Questions are unavailable until `POST /sessions/:id/consent`  
- Consent version + text hash stored on `ConsentRecord`  
- IP stored only as salted hash (optional)

## Visibility

| State | Creator | Respondent receipt |
|-------|---------|--------------------|
| SHARE | Yes | Yes |
| PRIVATE | Never | Yes |
| SKIPPED | Never | Shown as skipped |
| DECLINED | Never | Shown as declined |

Default UX does not silently share: respondents explicitly choose Share or Private when answering.

## AuthZ

- Creator routes require JWT and ownership checks (`creatorId`)  
- Play mutations require matching `receiptToken` hash for the session  
- Cross-creator IDOR returns 404 for foreign games  

## Tokens & sessions

- Invite / receipt tokens: cryptographically random, hashed at rest  
- Passwords: bcrypt cost 12  
- JWT in memory (localStorage) + httpOnly cookie for browser sessions  
- Rate limits on auth and play routes  

## Deletion & expiration

- Creator delete removes responses, consent, sessions, soft-deletes game  
- Respondent delete wipes responses + marks session deleted  
- Games auto-flip to `EXPIRED` when `expiresAt` passes  
- Sessions carry retention / expiry metadata for receipts  

## What we intentionally do not do

- Contact scraping / device contacts  
- Hidden location tracking  
- Silent answer sharing  
- Psychological diagnosis claims from AI  
