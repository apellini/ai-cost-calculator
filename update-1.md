## Update

# Models
- Has to retrieve all models available at the moment if refreshed, if there is a new model has to insert
- Has to retrieve all benchmark
- Has to write log when deprecate a model as NOTIFY
- Has to write log when find a new model as NOTIFY
- If refresh is started we need to see a log
- You have to trace errors when refresh failing notify when it happens and go forward.

# PROJECT
- User could switch Active Project

# COST CALCULATION
- PREMIUM seems that is so higher with fictional data

# INTERVIEW
- User could choice provider to filter models (Multiple)
- User could choice model to filter (Multiple)
- User could choice a mix provider and models (Multiple) if a model is of one provider you could not choice other model of the same provider
- PREFERRED MODEL has to suggest dynamically providers and/or models

# USER
- Project could be reserved, User has to choice users to share the project
- Invite user button doesn't work

# FIX
- Remove all orphaned project
- Delete a project goes in error:
Apr 07 22:19:54 iac-cost-001 uvicorn[1141]: sqlalchemy.exc.IntegrityError: (sqlalchemy.dialects.postgresql.asyncpg.IntegrityError) <class 'asyncpg.exceptions.ForeignKeyViolationError'>: update or delete on table "projects" violates foreign key constraint "notifications_project_id_fkey" on table "notifications"
Apr 07 22:19:54 iac-cost-001 uvicorn[1141]: DETAIL:  Key (id)=(9) is still referenced from table "notifications".
Apr 07 22:19:54 iac-cost-001 uvicorn[1141]: [SQL: DELETE FROM projects WHERE projects.id = $1::INTEGER]
Apr 07 22:19:54 iac-cost-001 uvicorn[1141]: [parameters: (9,)]
Apr 07 22:19:54 iac-cost-001 uvicorn[1141]: (Background on this error at: https://sqlalche.me/e/20/gkpj)

- ACTIONS on settings menu for user doesn't have any icon, change password, delete (only admin could not be deleted)
