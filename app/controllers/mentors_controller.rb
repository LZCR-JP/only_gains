class MentorsController < ApplicationController
  before_action :set_mentor, only: %i[show assign]
  before_action :set_plans, only: %i[index show]

  def index
    @mentors = Mentor.order(:id)
    @plan_counts = current_user.workout_plans.group(:mentor_id).count
  end

  def show
    @mentor_plans = @plans.select { |plan| plan.mentor_id == @mentor.id }
  end

  def assign
    plan = current_user.workout_plans.find_by(id: params[:workout_plan_id])

    if plan.nil?
      redirect_back_or_to mentors_path, alert: "Pick one of your plans first."
    elsif plan.update(mentor: @mentor)
      redirect_to workout_plan_path(plan),
                  notice: "#{@mentor.display_name} is now coaching “#{plan.title}”."
    else
      redirect_back_or_to mentors_path, alert: plan.errors.full_messages.to_sentence
    end
  end

  private

  def set_mentor
    @mentor = Mentor.find(params[:id])
  end

  def set_plans
    @plans = current_user.workout_plans.includes(:mentor).order(created_at: :desc)
  end
end
