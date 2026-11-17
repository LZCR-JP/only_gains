class WorkoutPlansController < ApplicationController
  before_action :authenticate_user!
  before_action :set_workout_plan, only: %i[show edit update destroy]

  def index
    @workout_plans = current_user.workout_plans
  end

  def show
  end

  def new
    @workout_plan = current_user.workout_plans.new
  end

  def create
    @workout_plan = current_user.workout_plans.build(workout_plan_params)
    @workout_plan.mentor = Mentor.for_goal(@workout_plan.goal)

    if @workout_plan.save
      redirect_to @workout_plan, notice: "Workout plan created!"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    @workout_plan.assign_attributes(workout_plan_params)
    @workout_plan.mentor = Mentor.for_goal(@workout_plan.goal)

    if @workout_plan.save
      redirect_to @workout_plan, notice: "Workout plan updated!"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def edit
  end

  def destroy
    @workout_plan.destroy

    redirect_to workout_plans_path,
                notice: "Workout plan deleted!",
                status: :see_other
  end

  private

  def set_workout_plan
    @workout_plan = current_user.workout_plans.find(params[:id])
  end

  def workout_plan_params
    params.require(:workout_plan).permit(
      :title,
      :goal,
      :fitness_level,
      :equipment,
      :training_days,
      :duration_minutes,
      :description
    )
  end
end
