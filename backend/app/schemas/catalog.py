from pydantic import BaseModel, Field


class DepartmentWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class CourseWrite(BaseModel):
    department_id: str = Field(alias="departmentId")
    course_name: str = Field(alias="courseName", min_length=1, max_length=160)
    course_code: str = Field(alias="courseCode", min_length=1, max_length=40)
    academic_level: str | None = Field(default=None, alias="academicLevel", max_length=40)
    semester: str | None = Field(default=None, max_length=40)

    model_config = {"populate_by_name": True}
