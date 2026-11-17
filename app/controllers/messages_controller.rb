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

    coach = AiCoachService.new(
      goal: workout_plan.goal,
      mentor: workout_plan.mentor,
      workout_plan: {
        title: workout_plan.title,
        goal: workout_plan.goal,
        fitness_level: workout_plan.fitness_level,
        equipment: workout_plan.equipment,
        training_days: workout_plan.training_days,
        duration_minutes: workout_plan.duration_minutes,
        description: workout_plan.description,
        workout: workout_plan.generated_workout
      }
    )

    reply = coach.chat(content, history: history)

    Message.transaction do
      @chat.messages.create!(
        role: "user",
        content: content
      )

      @chat.messages.create!(
        role: "assistant",
        content: reply
      )
    end

    redirect_to workout_plan_chat_path(workout_plan, @chat),
                status: :see_other
  rescue AiCoachService::ChatError => e
    redirect_to workout_plan_chat_path(@chat.workout_plan, @chat),
                alert: e.message,
                status: :see_other
  end

  private

  def message_params
    params.require(:message).permit(:content)
  end
end
