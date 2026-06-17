-- Remove 'database' from modules array for all plans since DB integration is no longer a feature
UPDATE subscription_plans SET modules = array_remove(modules, 'database');
