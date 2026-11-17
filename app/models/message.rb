class Message < ApplicationRecord
  belongs_to :chat

  validates :role, inclusion: { in: ["user", "assistant"] }
  validates :content, presence: true
end
