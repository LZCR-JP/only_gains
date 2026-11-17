class MessagesController < ApplicationController
  before_action :authenticate_user!

  def create
    @chat = Chat.find(params[:chat_id])
    content = message_params[:content]

    @chat.messages.create!(role: "user", content: content)
    reply = ai_reply(@chat, content)
    @chat.messages.create!(role: "assistant", content: reply)

    redirect_to workout_chat_path(@chat.workout_plan, @chat)
  end

  private

  def message_params
    params.require(:message).permit(:content)
  end

  def ai_reply(chat, content)
    llm_chat = RubyLLM.chat
    llm_chat.with_instructions(chat.workout_plan.mentor.system_prompt)
    llm_chat.ask(content).content
  end
end
