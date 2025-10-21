-- Update existing lawncare tasks with new structure
-- First, get all existing lawncare tasks and create new ones
DO $$
DECLARE
    lawn_task RECORD;
BEGIN
    -- Loop through all existing "Lawncare" tasks
    FOR lawn_task IN 
        SELECT * FROM onboarding_tasks 
        WHERE title = 'Lawncare' OR title LIKE 'Lawncare%'
    LOOP
        -- Insert new lawncare tasks for this project
        -- Only insert if they don't already exist
        
        -- Lawncare Company Name
        INSERT INTO onboarding_tasks (
            project_id, phase_number, phase_title, title, field_type,
            assigned_to, assigned_to_uuid, assigned_role_id, status, due_date
        )
        SELECT 
            lawn_task.project_id,
            lawn_task.phase_number,
            lawn_task.phase_title,
            'Lawncare Company Name',
            'text',
            lawn_task.assigned_to,
            lawn_task.assigned_to_uuid,
            lawn_task.assigned_role_id,
            'pending',
            lawn_task.due_date
        WHERE NOT EXISTS (
            SELECT 1 FROM onboarding_tasks 
            WHERE project_id = lawn_task.project_id 
            AND title = 'Lawncare Company Name'
        );
        
        -- Lawncare Phone Number
        INSERT INTO onboarding_tasks (
            project_id, phase_number, phase_title, title, field_type,
            assigned_to, assigned_to_uuid, assigned_role_id, status, due_date
        )
        SELECT 
            lawn_task.project_id,
            lawn_task.phase_number,
            lawn_task.phase_title,
            'Lawncare Phone Number',
            'phone',
            lawn_task.assigned_to,
            lawn_task.assigned_to_uuid,
            lawn_task.assigned_role_id,
            'pending',
            lawn_task.due_date
        WHERE NOT EXISTS (
            SELECT 1 FROM onboarding_tasks 
            WHERE project_id = lawn_task.project_id 
            AND title = 'Lawncare Phone Number'
        );
        
        -- Lawncare Schedule
        INSERT INTO onboarding_tasks (
            project_id, phase_number, phase_title, title, field_type, description,
            assigned_to, assigned_to_uuid, assigned_role_id, status, due_date
        )
        SELECT 
            lawn_task.project_id,
            lawn_task.phase_number,
            lawn_task.phase_title,
            'Lawncare Schedule',
            'radio',
            'Semi-Weekly|Monthly',
            lawn_task.assigned_to,
            lawn_task.assigned_to_uuid,
            lawn_task.assigned_role_id,
            'pending',
            lawn_task.due_date
        WHERE NOT EXISTS (
            SELECT 1 FROM onboarding_tasks 
            WHERE project_id = lawn_task.project_id 
            AND title = 'Lawncare Schedule'
        );
        
        -- Lawncare Negotiated Payment
        INSERT INTO onboarding_tasks (
            project_id, phase_number, phase_title, title, field_type,
            assigned_to, assigned_to_uuid, assigned_role_id, status, due_date
        )
        SELECT 
            lawn_task.project_id,
            lawn_task.phase_number,
            lawn_task.phase_title,
            'Lawncare Negotiated Payment',
            'currency',
            lawn_task.assigned_to,
            lawn_task.assigned_to_uuid,
            lawn_task.assigned_role_id,
            'pending',
            lawn_task.due_date
        WHERE NOT EXISTS (
            SELECT 1 FROM onboarding_tasks 
            WHERE project_id = lawn_task.project_id 
            AND title = 'Lawncare Negotiated Payment'
        );
        
    END LOOP;
    
    -- Delete old lawncare tasks
    DELETE FROM onboarding_tasks 
    WHERE title = 'Lawncare' AND field_type = 'text';
END $$;