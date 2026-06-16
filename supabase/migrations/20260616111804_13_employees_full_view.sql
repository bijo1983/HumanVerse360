-- Create a flat view for employees with department and position names resolved
CREATE OR REPLACE VIEW employees_full AS
SELECT
  e.*,
  d.name   AS department_name,
  d.code   AS department_code,
  p.title  AS position_title,
  p.grade  AS position_grade
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN positions  p ON e.position_id   = p.id;

-- Grant access to the same roles that can access employees
GRANT SELECT ON employees_full TO anon, authenticated;
