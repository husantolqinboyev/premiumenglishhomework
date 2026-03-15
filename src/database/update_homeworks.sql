-- Update homeworks table to add new statuses and teacher_comment field

-- First, drop the existing check constraint
ALTER TABLE homeworks DROP CONSTRAINT IF EXISTS homeworks_status_check;

-- Add the new check constraint with all statuses
ALTER TABLE homeworks 
ADD CONSTRAINT homeworks_status_check 
CHECK (status IN ('pending', 'submitted', 'overdue', 'accepted', 'rejected', 'commented'));

-- Add teacher_comment column if it doesn't exist
ALTER TABLE homeworks 
ADD COLUMN IF NOT EXISTS teacher_comment TEXT;

-- Success message
SELECT 'homeworks table updated successfully' as result;
