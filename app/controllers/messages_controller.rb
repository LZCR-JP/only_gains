class MessagesController < ApplicationController
  before_action :authenticate_user!

  def create
    @chat = current_user.chats.find(params[:chat_id])
    workout_plan = @chat.workout_plan
    content = message_params[:content].to_s.strip

    if content.blank?
      redirect_to workout_plan_chat_path(workout_plan, @chat),
                  alert: "Please enter a message.",
                  status: :see_other
      return
    end

    history = @chat.messages
                   .order(created_at: :desc, id: :desc)
                   .limit(20)
                   .to_a
                   .reverse
                   .map do |message|
      {
        role: message.role,
        content: message.content
      }
    end

    snapshot = workout_plan.generated_workout.deep_dup
    plan_updated_at = workout_plan.updated_at

    profile = {
      title: workout_plan.title,
      goal: workout_plan.goal,
      fitness_level: workout_plan.fitness_level,
      equipment: workout_plan.equipment,
      training_days: workout_plan.training_days,
      duration_minutes: workout_plan.duration_minutes,
      description: workout_plan.description
    }

    if snapshot.present?
      service = WorkoutChangeProposalService.new(
        goal: workout_plan.goal,
        mentor: workout_plan.mentor,
        workout_plan: snapshot,
        profile: profile
      )

      result = service.call(content, history: history)
    else
      coach = AiCoachService.new(
        goal: workout_plan.goal,
        mentor: workout_plan.mentor,
        workout_plan: profile
      )

      result = {
        "message" => coach.chat(content, history: history),
        "proposal" => nil
      }
    end

    Message.transaction do
      @chat.messages.create!(
        role: "user",
        content: content
      )

      assistant_message = @chat.messages.create!(
        role: "assistant",
        content: result.fetch("message")
      )

      if result["proposal"].present?
        assistant_message.create_workout_change_proposal!(
          proposal: result["proposal"],
          workout_snapshot: snapshot,
          plan_updated_at: plan_updated_at,
          status: "pending"
        )
      end
    end

    redirect_to workout_plan_chat_path(workout_plan, @chat),
                status: :see_other
  rescue AiCoachService::ChatError,
         WorkoutChangeProposalService::ProposalError => e

    redirect_to workout_plan_chat_path(@chat.workout_plan, @chat),
                alert: e.message,
                status: :see_other
  end

  private

  def message_params
    params.require(:message).permit(:content)
  end
end
