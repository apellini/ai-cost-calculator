# AI Cost Calculator
You have to build a web application that analyze user requirements and produce a detailed cost table of AI Usage Costs with suggestion.

## Input
- User has to be intervied via simple questions to understand the need (**you have to understand all features that has to be developed**)
- User could suggest model that has to be used
- User could suggest its budget that could allocate for the project
- User could input to tool with a Markdown specs to tells its requirements

## Backend
- Application has to analyze the user request with an AI with a specialized LLM Model that could run locally. Find the best model.
- 

## Model Analisys
- Understand all price model of commercial LLM that are existing
- Understand all capability based on their scoring results taken dynamically from Public Benchmarks
- Classify all Models to match specific task
- Calculate a media of tokens (consider always worst case) to accomplish a task. Consider also iteration for finalizing or solving bug.
- Refresh all models that are available, if one disappear take with specifical warning if is used by an older analysis, but it is not usable for new evaluations.

## User preferences
- User could modify model or force a model. This could affect the number of tokens used.
- User could not modify number of token calculated

## Warning
- Advise user if budget is not enough to accomplish all task, in this case suggest all tasks that could be accomplished with the current budget allocation based on AI effectiveness

## Snapshot
- Bundle and price are snapshopted to guarantee right history, user could refresh
- Capabilities are snapshopted, user could refresh

