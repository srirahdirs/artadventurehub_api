# Campaign Management System - Flow & API Documentation

## Overview
The campaign system allows admins to create art competitions where users can participate by submitting their artwork and win prizes.

---

## Database Collections

### 1. **campaigns** Collection
Stores campaign details created by admin.

**Schema:**
```javascript
{
  name: "Tajmahal Campaign",
  description: "Paint the iconic Taj Mahal",
  reference_image: "https://example.com/tajmahal.jpg",
  max_participants: 20,
  current_participants: 0,
  entry_fee: {
    amount: 100,
    type: "rupees" // or "points"
  },
  prizes: {
    first_prize: 1000,
    second_prize: 500,
    platform_share: 500
  },
  status: "active", // draft, active, completed, cancelled
  start_date: Date,
  end_date: Date,
  submission_deadline: Date,
  result_date: Date,
  rules: "Campaign rules text",
  category: "drawing", // drawing, coloring, painting, mixed
  age_group: "all", // kids, teens, adults, all
  created_by: "Admin"
}
```

### 2. **campaignsubmissions** Collection
Stores user submissions for campaigns.

**Schema:**
```javascript
{
  campaign_id: ObjectId (ref: Campaign),
  user_id: ObjectId (ref: User),
  submission_image: "https://example.com/user-artwork.jpg",
  title: "My Taj Mahal Painting",
  description: "Description of artwork",
  payment_status: "paid", // pending, paid, refunded
  payment_method: "rupees", // rupees, points
  payment_amount: 100,
  transaction_id: "TXN123456",
  status: "submitted", // submitted, under_review, approved, rejected, winner, runner_up
  votes: 0,
  likes: 0,
  admin_rating: 0, // 0-10
  admin_notes: "Admin feedback",
  prize_won: {
    amount: 1000,
    position: "first" // first, second, none
  },
  submitted_at: Date
}
```

---

## API Endpoints

### ADMIN ENDPOINTS

#### 1. Create Campaign
```
POST /api/campaigns/admin/create

Body:
{
  "name": "Tajmahal Campaign",
  "description": "Paint the iconic Taj Mahal and win prizes!",
  "reference_image": "https://example.com/tajmahal.jpg",
  "max_participants": 20,
  "entry_fee_amount": 100,
  "entry_fee_type": "rupees",
  "first_prize": 1000,
  "second_prize": 500,
  "platform_share": 500,
  "start_date": "2025-10-15",
  "end_date": "2025-10-30",
  "submission_deadline": "2025-10-28",
  "result_date": "2025-11-01",
  "rules": "1. Submit original artwork only\n2. Follow theme strictly",
  "category": "drawing",
  "age_group": "all"
}

Response:
{
  "success": true,
  "message": "Campaign created successfully",
  "campaign": {...}
}
```

#### 2. Get All Campaigns (with filters)
```
GET /api/campaigns/admin/all?status=active&category=drawing

Response:
{
  "success": true,
  "count": 5,
  "campaigns": [...]
}
```

#### 3. Get Campaign Details with Submissions
```
GET /api/campaigns/admin/:id

Response:
{
  "success": true,
  "campaign": {...},
  "submissions": [...]
}
```

#### 4. Update Campaign
```
PUT /api/campaigns/admin/:id

Body:
{
  "name": "Updated Campaign Name",
  "max_participants": 30,
  "first_prize": 1500
}

Response:
{
  "success": true,
  "message": "Campaign updated successfully",
  "campaign": {...}
}
```

#### 5. Update Campaign Status
```
PATCH /api/campaigns/admin/:id/status

Body:
{
  "status": "active" // draft, active, completed, cancelled
}

Response:
{
  "success": true,
  "message": "Campaign active successfully"
}
```

#### 6. Rate Submission & Declare Winners
```
PUT /api/campaigns/admin/submission/:id/rate

Body:
{
  "rating": 9,
  "notes": "Excellent use of colors!",
  "status": "winner",
  "prize_position": "first"
}

Response:
{
  "success": true,
  "message": "Submission rated successfully",
  "submission": {...}
}
```

#### 7. Get Campaign Statistics
```
GET /api/campaigns/admin/stats

Response:
{
  "success": true,
  "stats": {
    "total_campaigns": 10,
    "active_campaigns": 3,
    "completed_campaigns": 5,
    "total_submissions": 150,
    "total_revenue": 15000
  }
}
```

#### 8. Delete Campaign
```
DELETE /api/campaigns/admin/:id

Response:
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

---

### USER/PUBLIC ENDPOINTS

#### 1. Get Active Campaigns
```
GET /api/campaigns/active

Response:
{
  "success": true,
  "count": 3,
  "campaigns": [
    {
      "id": "...",
      "name": "Tajmahal Campaign",
      "description": "...",
      "reference_image": "...",
      "max_participants": 20,
      "current_participants": 15,
      "entry_fee": { "amount": 100, "type": "rupees" },
      "prizes": {...},
      "is_full": false,
      "slots_remaining": 5
    }
  ]
}
```

#### 2. Submit Artwork
```
POST /api/campaigns/submit

Body:
{
  "campaign_id": "campaign_id_here",
  "user_id": "user_id_here",
  "submission_image": "https://example.com/my-artwork.jpg",
  "title": "My Beautiful Taj Mahal",
  "description": "Created with watercolors",
  "payment_method": "rupees"
}

Response:
{
  "success": true,
  "message": "Artwork submitted successfully",
  "submission": {...}
}
```

#### 3. Get User's Submissions
```
GET /api/campaigns/user/:user_id/submissions

Response:
{
  "success": true,
  "count": 3,
  "submissions": [...]
}
```

#### 4. Get Campaign Leaderboard
```
GET /api/campaigns/:campaign_id/leaderboard

Response:
{
  "success": true,
  "count": 20,
  "leaderboard": [
    {
      "rank": 1,
      "user": { "username": "artist123" },
      "submission_image": "...",
      "rating": 9.5,
      "votes": 150,
      "status": "winner",
      "prize": { "amount": 1000, "position": "first" }
    }
  ]
}
```

---

## Campaign Workflow

### ADMIN WORKFLOW

1. **Create Campaign**
   - Admin creates campaign with name, reference image, prizes
   - Sets participant limit and entry fee
   - Sets dates (start, end, submission deadline, result)
   - Status: `draft`

2. **Activate Campaign**
   - Admin reviews and activates campaign
   - Status: `draft` → `active`
   - Users can now see and participate

3. **Monitor Submissions**
   - Admin views all submissions via GET `/admin/:id`
   - Sees participant count, submission images

4. **Rate & Judge**
   - Admin rates each submission (0-10)
   - Adds notes/feedback
   - Marks best 2 as winners

5. **Declare Winners**
   - Admin sets `prize_position: "first"` or `"second"`
   - System auto-assigns prize amounts
   - Status updates to `winner` or `runner_up`

6. **Complete Campaign**
   - Admin updates campaign status to `completed`
   - Winners announced on leaderboard

### USER WORKFLOW

1. **Browse Campaigns**
   - User views active campaigns via GET `/active`
   - Sees reference image, prizes, slots remaining

2. **Pay Entry Fee**
   - User pays entry fee (100 rupees or points)
   - Payment verified

3. **Submit Artwork**
   - User uploads their painted/drawn version
   - Adds title and description
   - POST `/submit`

4. **Track Status**
   - User views their submission status
   - GET `/user/:user_id/submissions`

5. **Check Leaderboard**
   - User views rankings and winners
   - GET `/:campaign_id/leaderboard`

6. **Receive Prize**
   - If winner, prize credited to account

---

## Revenue Model Example

**Campaign: Tajmahal Campaign**
- Max Participants: 20
- Entry Fee: ₹100 per person
- Total Collection: 20 × ₹100 = ₹2,000

**Prize Distribution:**
- 1st Prize: ₹1,000
- 2nd Prize: ₹500
- Platform Share: ₹500
- **Total: ₹2,000** ✅

**Profit for Platform: ₹500**

---

## Next Steps for Frontend Implementation

### Admin Panel Pages Needed:
1. **Campaign List Page** - View all campaigns with status
2. **Create Campaign Page** - Form to create new campaign
3. **Campaign Detail Page** - View submissions, rate artwork
4. **Dashboard** - Statistics and overview

### User Pages Needed:
1. **Browse Campaigns** - Grid of active competitions
2. **Campaign Detail** - View reference image, rules, submit artwork
3. **My Submissions** - Track submitted artworks
4. **Leaderboard** - View rankings and winners

---

## Testing the APIs

### Create a Test Campaign:
```bash
curl -X POST http://localhost:5000/api/campaigns/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tajmahal Campaign",
    "description": "Paint the beautiful Taj Mahal",
    "reference_image": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edit3.jpg/800px-Taj_Mahal%2C_Agra%2C_India_edit3.jpg",
    "max_participants": 20,
    "entry_fee_amount": 100,
    "entry_fee_type": "rupees",
    "first_prize": 1000,
    "second_prize": 500,
    "platform_share": 500,
    "category": "drawing",
    "age_group": "all"
  }'
```

### Get Active Campaigns:
```bash
curl http://localhost:5000/api/campaigns/active
```

---

## Database Relationships

```
User (users collection)
  └─> CampaignSubmission (campaignsubmissions collection)
        └─> Campaign (campaigns collection)
```

**One user can submit to multiple campaigns**
**One campaign can have multiple submissions**
**But one user can only submit ONCE per campaign** ✅

---

## Security Considerations

1. ✅ Admin routes should have authentication middleware
2. ✅ Validate user owns submission before allowing edits
3. ✅ Check campaign status before allowing submissions
4. ✅ Verify payment before marking as paid
5. ✅ Rate limiting on submission endpoints
6. ✅ Image upload validation (size, format)

---

## Future Enhancements

- [ ] Public voting system (like/vote on submissions)
- [ ] Real-time leaderboard updates
- [ ] Email notifications for winners
- [ ] Automated prize distribution
- [ ] Campaign templates
- [ ] Multi-language support
- [ ] Social media sharing
- [ ] Certificate generation for winners

