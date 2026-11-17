class WorkoutChangeProposalsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_proposal

  def accept
    status = @proposal.accept!

    case status
    when "accepted"
      redirect_to chat_path,
                  notice: "Workout updated successfully!",
                  status: :see_other
    when "stale"
      redirect_to chat_path,
                  alert: "Your workout has changed. Please request a new proposal.",
                  status: :see_other
    else
      redirect_to chat_path,
                  alert: "This proposal is no longer pending.",
                  status: :see_other
    end
  end

  def reject
    status = @proposal.reject!

    if status == "rejected"
      redirect_to chat_path,
                  notice: "Change rejected. Your workout remains unchanged.",
                  status: :see_other
    else
      redirect_to chat_path,
                  alert: "This proposal is no longer pending.",
                  status: :see_other
    end
  end

  private

  def set_proposal
    @proposal = WorkoutChangeProposal
                .joins(message: { chat: :workout_plan })
                .where(workout_plans: { user_id: current_user.id })
                .find(params[:id])
  end

  def chat_path
    chat = @proposal.message.chat

    workout_plan_chat_path(chat.workout_plan, chat)
  end
end
