#!/bin/bash
SECRET=$(grep CRON_SECRET .env.local | cut -d= -f2)
curl -s -H "Authorization: Bearer $SECRET" http://localhost:3000/api/send-reminders
