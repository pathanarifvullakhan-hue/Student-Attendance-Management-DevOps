# Final project checklist

Use this checklist for the project demonstration. Mark each item only after verifying it.

## Functional modules
- [ ] Add a student with roll number, name, and department.
- [ ] Display all students.
- [ ] Edit student details.
- [ ] Reject blank student fields.
- [ ] Reject duplicate roll numbers.
- [ ] Select attendance date.
- [ ] Show the full class list on one page.
- [ ] Show Periods 1–7.
- [ ] Mark each period Present or Absent.
- [ ] Mark all present.
- [ ] Mark all absent.
- [ ] Save and retrieve attendance by date.
- [ ] Correct previously saved attendance.
- [ ] Prevent duplicate student/date/period records.
- [ ] Retrieve daily attendance history.
- [ ] Calculate monthly working periods.
- [ ] Calculate periods attended and absent.
- [ ] Calculate attendance percentage.
- [ ] Identify students below the threshold.
- [ ] Generate student-wise monthly report.
- [ ] Generate class-wise monthly summary.
- [ ] Export monthly CSV.
- [ ] Export daily CSV.
- [ ] Verify data persists after app restart.

## DevOps
- [ ] Git repository initialized.
- [ ] Source code pushed to GitHub.
- [ ] Jenkins checks out source.
- [ ] Jenkins validates code and runs API tests.
- [ ] Jenkins builds Docker image.
- [ ] Docker image runs locally.
- [ ] Kubernetes Deployment and Service created.
- [ ] Persistent volume configured for SQLite.
- [ ] Selenium smoke tests executed.
- [ ] Demonstration performed against the running app.

## Ten Selenium requirements from the project document
1. [ ] Attendance page displays all registered students.
2. [ ] Attendance can be marked for all seven periods.
3. [ ] Attendance saves for a selected date.
4. [ ] Missing or invalid student information is handled.
5. [ ] Duplicate attendance entries are prevented.
6. [ ] Monthly attendance totals are correct.
7. [ ] Attendance percentage is correct.
8. [ ] Students below threshold are identified.
9. [ ] Monthly report can be generated and exported.
10. [ ] Saved records remain available after restart.
